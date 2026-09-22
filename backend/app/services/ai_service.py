import asyncio
from datetime import datetime, timezone
import json
import logging
import re
import time
from typing import Any, Dict, List, Optional, Type, TypeVar
from pydantic import BaseModel

from google import genai
from google.genai import types

from app.config import get_settings
from app.database.mongodb import db_manager
from app.schemas.ai import (
    GenerateTasksResponse,
    GeneratedTaskItem,
    PlanMilestone,
    PlanTask,
    PrioritizeResponse,
    PrioritizedTaskItem,
    ProjectPlanResponse,
    SummarizeProjectResponse,
    TokenUsage,
)

logger = logging.getLogger("taskpilot.ai_service")
settings = get_settings()

T = TypeVar("T", bound=BaseModel)

# Default comprehensive Gemini generation model pool (active Gemini 3 text models)
FALLBACK_GEMINI_MODELS_CATALOG = [
    "gemini-3-flash-preview",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-flash-latest",
]


class AIService:
    """Async Google Gemini LLM integration service with universal multi-model failover and structured outputs."""

    def __init__(self) -> None:
        self.client: Optional[genai.Client] = None
        self._discovered_models: List[str] = []
        self._last_discovery_time: float = 0.0
        self._model_cooldowns: Dict[str, float] = {}
        self._preferred_model: Optional[str] = None

        gemini_key = settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY else ""
        if gemini_key:
            try:
                self.client = genai.Client(api_key=gemini_key)
                logger.info("Google Gemini client initialized with primary model: %s", settings.GEMINI_MODEL)
            except Exception as e:
                logger.warning("Failed to initialize Google Gemini client: %s", e)
                self.client = None
        else:
            logger.info("No GEMINI_API_KEY detected. AIService will run in development synthesis fallback mode.")

    def get_all_candidate_models(self) -> List[str]:
        """Returns complete, priority-ordered list of all valid Gemini models with automatic health ordering.

        Dynamically queries Google GenAI to discover all active generation models available to the API key,
        combines them with settings and built-in catalogs, and prioritizes healthy models over exhausted ones.
        """
        now = time.time()

        # 1. Discover all active Gemini models from Google API if client available and cache expired (> 1h)
        if self.client and (now - self._last_discovery_time > 3600 or not self._discovered_models):
            try:
                found = []
                for m in self.client.models.list():
                    clean_name = m.name.replace("models/", "").strip()
                    # Filter for active text/generation Gemini models
                    if "gemini" in clean_name and not any(
                        bad in clean_name
                        for bad in [
                            "tts", "image", "transcribe", "audio", "robotics",
                            "clip", "embedding", "live", "realtime", "customtools",
                            "computer-use", "omni", "2.5", "2.0", "1.5"
                        ]
                    ):
                        found.append(clean_name)
                if found:
                    self._discovered_models = found
                    self._last_discovery_time = now
                    logger.info("Dynamically discovered %d Gemini models from Google API: %s", len(found), found)
            except Exception as exc:
                logger.debug("Dynamic Gemini model discovery skipped or failed: %s", exc)

        # 2. Build candidate pool in logical priority:
        # Preferred active model -> configured primary -> configured fallbacks -> discovered models -> catalog
        primary = settings.GEMINI_MODEL or "gemini-3-flash-preview"
        configured_fallbacks = (
            settings.GEMINI_FALLBACK_MODELS
            if isinstance(settings.GEMINI_FALLBACK_MODELS, list)
            else [settings.GEMINI_FALLBACK_MODELS]
        )

        raw_list: List[str] = []
        if self._preferred_model:
            raw_list.append(self._preferred_model)
        raw_list.append(primary)
        raw_list.extend(configured_fallbacks)
        raw_list.extend(self._discovered_models)
        raw_list.extend(FALLBACK_GEMINI_MODELS_CATALOG)

        # Deduplicate while strictly preserving priority order
        seen = set()
        deduped: List[str] = []
        for m in raw_list:
            clean = str(m).replace("models/", "").strip()
            if clean and clean not in seen:
                seen.add(clean)
                deduped.append(clean)

        # 3. Partition: Healthy models first; models currently in cooldown (e.g. rate limited or 429) at the end
        healthy_models = [m for m in deduped if self._model_cooldowns.get(m, 0.0) <= now]
        cooldown_models = [m for m in deduped if self._model_cooldowns.get(m, 0.0) > now]

        return healthy_models + cooldown_models

    async def _log_token_usage(
        self,
        endpoint: str,
        user_id: Optional[str],
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> None:
        """Persist generation token consumption to MongoDB ai_generations collection."""
        try:
            db = db_manager.get_database()
            record = {
                "endpoint": endpoint,
                "user_id": user_id,
                "model": model,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
                "created_at": datetime.now(timezone.utc),
            }
            await db.ai_generations.insert_one(record)
        except Exception as e:
            logger.warning("Failed to record token usage telemetry: %s", e)

    def _sanitize_json_string(self, raw_text: str) -> str:
        """Strip markdown code fences and extraneous text outside the outermost JSON object/array."""
        text = raw_text.strip()
        # Remove ```json ... ``` or ``` ... ```
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

        # Find first { and last }
        first_brace = text.find("{")
        last_brace = text.rfind("}")
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            return text[first_brace : last_brace + 1]

        # Or array [ ... ]
        first_bracket = text.find("[")
        last_bracket = text.rfind("]")
        if first_bracket != -1 and last_bracket != -1 and last_bracket > first_bracket:
            return text[first_bracket : last_bracket + 1]

        return text

    async def _call_llm_json(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        endpoint_name: str,
        user_id: Optional[str] = None,
    ) -> tuple[T, TokenUsage]:
        """Invoke Gemini with automatic universal model failover across all Gemini models.

        If any model hits its token limit, rate limit (HTTP 429), or quota exhaustion (ResourceExhausted),
        it puts that model into cooldown and immediately attempts the next Gemini model in the pool.
        """
        if not self.client:
            raise RuntimeError("Google Gemini client not available.")

        models_to_try = self.get_all_candidate_models()
        last_error = None
        start_time = time.time()
        max_attempts = 3
        max_total_wait = 20.0  # seconds

        attempts = 0
        for model in models_to_try:
            if attempts >= max_attempts or (time.time() - start_time) > max_total_wait:
                logger.info(
                    "LLM failover threshold reached (attempts=%d, elapsed=%.1fs). Fast-failing to fallback engine.",
                    attempts,
                    time.time() - start_time,
                )
                break
            attempts += 1

            try:
                logger.info(
                    "Invoking Gemini model [%s] for endpoint [%s] (attempt %d/%d, pool of %d models)...",
                    model,
                    endpoint_name,
                    attempts,
                    max_attempts,
                    len(models_to_try),
                )

                contents = f"{system_prompt}\n\n{user_prompt}" if system_prompt else user_prompt
                config = types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=response_model,
                    temperature=settings.GEMINI_TEMPERATURE,
                )

                # Wrap invocation in per-model timeout to avoid hanging connections
                remaining_time = max(5.0, max_total_wait - (time.time() - start_time))
                per_model_timeout = min(12.0, remaining_time)
                response = await asyncio.wait_for(
                    self.client.aio.models.generate_content(
                        model=model,
                        contents=contents,
                        config=config,
                    ),
                    timeout=per_model_timeout,
                )

                # Extract token telemetry
                prompt_tokens = 0
                completion_tokens = 0
                total_tokens = 0
                if response.usage_metadata:
                    prompt_tokens = response.usage_metadata.prompt_token_count or 0
                    completion_tokens = response.usage_metadata.candidates_token_count or 0
                    total_tokens = response.usage_metadata.total_token_count or (prompt_tokens + completion_tokens)

                token_usage = TokenUsage(
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    model=model,
                )

                # Validate structured output into Pydantic model
                if response.text:
                    try:
                        validated_model = response_model.model_validate_json(response.text)
                    except Exception:
                        clean_json = self._sanitize_json_string(response.text)
                        validated_model = response_model.model_validate_json(clean_json)
                elif response.parsed:
                    validated_model = response_model.model_validate(response.parsed)
                else:
                    raise ValueError(f"Empty or unparsable response received from Gemini model {model}.")

                # Mark model as healthy preferred model
                self._preferred_model = model
                self._model_cooldowns.pop(model, None)

                # Persist token telemetry to MongoDB
                await self._log_token_usage(
                    endpoint=endpoint_name,
                    user_id=user_id,
                    model=model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                )

                logger.info("Successfully generated structured output with Gemini model [%s]", model)
                return validated_model, token_usage

            except Exception as exc:
                exc_str = str(exc).lower()
                # If model is deprecated / not found, cool down for 1 hour; otherwise cool down for 60 seconds
                cooldown_secs = 3600.0 if ("404" in exc_str or "not found" in exc_str) else 60.0
                self._model_cooldowns[model] = time.time() + cooldown_secs

                logger.warning(
                    "Gemini model [%s] failed or token/rate limit reached: %s. Automatically trying next Gemini model from pool of %d models...",
                    model,
                    exc,
                    len(models_to_try),
                )
                last_error = exc

        raise RuntimeError(f"All Gemini models exhausted ({attempts} models tested in {time.time() - start_time:.1f}s). Last error: {last_error}")

    # ==========================================================================
    # 1. Project Plan Synthesis
    # ==========================================================================

    async def generate_project_plan(
        self,
        idea_prompt: str,
        domain: str = "Software Engineering",
        duration_weeks: int = 4,
        user_id: Optional[str] = None,
    ) -> ProjectPlanResponse:
        """Synthesize a complete project breakdown with milestones, tasks, priorities, and dependencies."""
        system_prompt = (
            "You are a Principal Software Architect & Technical Program Director. "
            "Your task is to take a product idea and generate a production-ready, highly granular project plan. "
            "Output JSON with this exact schema:\n"
            "{\n"
            '  "title": "string (clear, professional project name)",\n'
            '  "description": "string (comprehensive executive summary and architecture scope)",\n'
            '  "suggested_tags": ["string", "string"],\n'
            '  "milestones": [\n'
            '    {"id": "m1", "title": "string", "description": "string", "target_week": 1}\n'
            "  ],\n"
            '  "tasks": [\n'
            '    {\n'
            '      "id": "t1",\n'
            '      "title": "string",\n'
            '      "description": "string (acceptance criteria & implementation specifics)",\n'
            '      "milestone_id": "m1",\n'
            '      "priority": "HIGH" | "CRITICAL" | "MEDIUM" | "LOW",\n'
            '      "estimated_days": 2,\n'
            '      "dependencies": [],\n'
            '      "tags": ["frontend", "auth"]\n'
            "    }\n"
            "  ]\n"
            "}\n"
            "Generate at least 3-4 milestones and 8-15 sequential, interdependent tasks."
        )

        user_prompt = (
            f"Project Idea: {idea_prompt}\n"
            f"Industry / Technical Domain: {domain}\n"
            f"Estimated Timeline: {duration_weeks} weeks\n"
            "Create a realistic, battle-tested roadmap."
        )

        try:
            if self.client:
                plan, tokens = await self._call_llm_json(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    response_model=ProjectPlanResponse,
                    endpoint_name="project-plan",
                    user_id=user_id,
                )
                plan.token_usage = tokens
                return plan
        except Exception as err:
            logger.warning("Gemini API execution failed for project-plan: %s. Falling back to synthetic engine.", err)

        # Synthetic fallback plan for offline or unconfigured Gemini keys
        return self._synthesize_fallback_project_plan(idea_prompt, domain, duration_weeks)

    def _synthesize_fallback_project_plan(
        self,
        idea: str,
        domain: str,
        weeks: int,
    ) -> ProjectPlanResponse:
        """Deterministic, rich fallback project generator for offline or key-free environments."""
        clean_title = f"{idea.strip().capitalize()[:40]} System Architecture"
        return ProjectPlanResponse(
            title=clean_title,
            description=(
                f"Production deployment roadmap for {idea} in the {domain} domain. "
                f"Designed as a resilient {weeks}-week agile delivery schedule encompassing backend microservices, "
                "data pipeline engineering, security compliance, and reactive frontend client applications."
            ),
            suggested_tags=[domain.lower().replace(" ", "-"), "cloud-native", "fastapi", "react", "mvp"],
            milestones=[
                PlanMilestone(
                    id="m1",
                    title="Phase 1: Architecture & Foundation",
                    description="Environment scaffolding, authentication layer, and database schema specifications.",
                    target_week=1,
                ),
                PlanMilestone(
                    id="m2",
                    title="Phase 2: Core Business Logic & APIs",
                    description="High-throughput CRUD pipelines, external integrations, and validation testing.",
                    target_week=max(2, weeks // 2),
                ),
                PlanMilestone(
                    id="m3",
                    title="Phase 3: User Interface & Experience",
                    description="Responsive dashboard, real-time reactive state management, and glassmorphic UI.",
                    target_week=max(3, (weeks * 3) // 4),
                ),
                PlanMilestone(
                    id="m4",
                    title="Phase 4: Hardening & Release Deployment",
                    description="Performance load tests, CI/CD pipeline rollout, and production launch checklist.",
                    target_week=weeks,
                ),
            ],
            tasks=[
                PlanTask(
                    id="t1",
                    title="Initialize Monorepo Scaffolding & CI Pipeline",
                    description="Configure Git workflows, automated linting, pre-commit hooks, and Docker containers.",
                    milestone_id="m1",
                    priority="HIGH",
                    estimated_days=2,
                    dependencies=[],
                    tags=["DevOps", "Infrastructure"],
                ),
                PlanTask(
                    id="t2",
                    title="Implement Database Schema & Connection Pools",
                    description="Deploy MongoDB collections, compound indexes, and connection health ping telemetry.",
                    milestone_id="m1",
                    priority="CRITICAL",
                    estimated_days=2,
                    dependencies=["t1"],
                    tags=["Database", "Backend"],
                ),
                PlanTask(
                    id="t3",
                    title="Build JWT Authentication & Role-Based Access Control",
                    description="Implement password hashing, token issue/refresh, and permission dependencies.",
                    milestone_id="m1",
                    priority="CRITICAL",
                    estimated_days=3,
                    dependencies=["t2"],
                    tags=["Security", "Auth"],
                ),
                PlanTask(
                    id="t4",
                    title="Develop Core Domain CRUD REST Endpoints",
                    description="Build transactional API endpoints with comprehensive Pydantic request validation.",
                    milestone_id="m2",
                    priority="HIGH",
                    estimated_days=4,
                    dependencies=["t3"],
                    tags=["API", "Backend"],
                ),
                PlanTask(
                    id="t5",
                    title="Design Reactive State Store & Frontend Services",
                    description="Setup Axios HTTP client interceptors, global auth state, and toast alert listeners.",
                    milestone_id="m2",
                    priority="MEDIUM",
                    estimated_days=3,
                    dependencies=["t3"],
                    tags=["Frontend", "State"],
                ),
                PlanTask(
                    id="t6",
                    title="Construct Glassmorphic Dashboard & Interactive Grid",
                    description="Build fluid Framer Motion cards, Recharts data analytics, and responsive layout shell.",
                    milestone_id="m3",
                    priority="HIGH",
                    estimated_days=4,
                    dependencies=["t4", "t5"],
                    tags=["Frontend", "UI/UX"],
                ),
                PlanTask(
                    id="t7",
                    title="Integrate Real-Time Notification & Audit Stream",
                    description="Wire in-app activity logging, notification triggers, and slide-over notification drawer.",
                    milestone_id="m3",
                    priority="MEDIUM",
                    estimated_days=2,
                    dependencies=["t6"],
                    tags=["Notifications", "FullStack"],
                ),
                PlanTask(
                    id="t8",
                    title="Execute E2E Integration Testing & Performance Audit",
                    description="Run concurrency tests, verify database query latency, and perform security audit.",
                    milestone_id="m4",
                    priority="HIGH",
                    estimated_days=3,
                    dependencies=["t7"],
                    tags=["QA", "Testing"],
                ),
            ],
            token_usage=TokenUsage(
                prompt_tokens=420,
                completion_tokens=680,
                total_tokens=1100,
                model=f"{settings.GEMINI_MODEL} (synthesized)",
            ),
        )

    # ==========================================================================
    # 2. Granular Task Quick-Generation
    # ==========================================================================

    async def generate_tasks(
        self,
        prompt: str,
        project_context: Optional[str] = None,
        count: int = 6,
        user_id: Optional[str] = None,
    ) -> GenerateTasksResponse:
        """Decompose a feature idea or user story into 5-10 actionable task cards."""
        system_prompt = (
            "You are a Staff Software Engineer. Decompose the requested feature into granular, high-impact tasks. "
            "Output JSON with this exact schema:\n"
            "{\n"
            '  "tasks": [\n'
            '    {\n'
            '      "title": "string",\n'
            '      "description": "string (clear acceptance criteria)",\n'
            '      "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",\n'
            '      "tags": ["string", "string"],\n'
            '      "estimated_hours": 4\n'
            "    }\n"
            "  ]\n"
            "}\n"
            f"Generate exactly {count} distinct tasks."
        )

        user_prompt = f"Feature Request: {prompt}\n"
        if project_context:
            user_prompt += f"Project Context / Stack: {project_context}\n"

        try:
            if self.client:
                res, tokens = await self._call_llm_json(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    response_model=GenerateTasksResponse,
                    endpoint_name="generate-tasks",
                    user_id=user_id,
                )
                res.token_usage = tokens
                return res
        except Exception as err:
            logger.warning("Gemini generate_tasks failed: %s. Falling back to synthetic tasks.", err)

        # Synthetic task fallback
        return GenerateTasksResponse(
            tasks=[
                GeneratedTaskItem(
                    title=f"Draft Technical Specification for {prompt}",
                    description=f"Outline data models, state transitions, and API contracts for {prompt}.",
                    priority="HIGH",
                    tags=["Planning", "Architecture"],
                    estimated_hours=4,
                ),
                GeneratedTaskItem(
                    title=f"Implement Backend Data Schemas & Routes for {prompt}",
                    description=f"Create Pydantic models and CRUD endpoint handlers for {prompt}.",
                    priority="HIGH",
                    tags=["Backend", "FastAPI"],
                    estimated_hours=6,
                ),
                GeneratedTaskItem(
                    title=f"Build Frontend Interface & State Management for {prompt}",
                    description=f"Develop responsive UI components and wire API integration for {prompt}.",
                    priority="MEDIUM",
                    tags=["Frontend", "React"],
                    estimated_hours=8,
                ),
                GeneratedTaskItem(
                    title=f"Unit & Integration Testing for {prompt}",
                    description=f"Ensure regression coverage, validation checks, and error boundary handling for {prompt}.",
                    priority="MEDIUM",
                    tags=["Testing", "QA"],
                    estimated_hours=4,
                ),
                GeneratedTaskItem(
                    title=f"Security & Performance Optimization for {prompt}",
                    description=f"Audit query indices, payload sanitization, and access control for {prompt}.",
                    priority="LOW",
                    tags=["Security", "Optimization"],
                    estimated_hours=3,
                ),
            ],
            token_usage=TokenUsage(
                prompt_tokens=220,
                completion_tokens=390,
                total_tokens=610,
                model=f"{settings.GEMINI_MODEL} (synthesized)",
            ),
        )

    # ==========================================================================
    # 3. Task Prioritization & Blocker Analysis
    # ==========================================================================

    async def prioritize_tasks(
        self,
        tasks: List[Dict[str, Any]],
        bottlenecks: Optional[str] = None,
        target_deadline: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> PrioritizeResponse:
        """Evaluate task queue against deadlines and blockers to generate prioritized ranking with rationales."""
        if not tasks:
            return PrioritizeResponse(
                ranked_tasks=[],
                strategic_advice="No active tasks provided for prioritization analysis.",
            )

        system_prompt = (
            "You are an Agile Delivery Lead & Productivity Strategist. Analyze the provided tasks, "
            "consider bottlenecks and target delivery dates, and return prioritized rankings. "
            "Output JSON with this exact schema:\n"
            "{\n"
            '  "ranked_tasks": [\n'
            '    {\n'
            '      "task_id": "string",\n'
            '      "title": "string",\n'
            '      "recommended_priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",\n'
            '      "urgency_rank": 1,\n'
            '      "category_tag": "Urgent Blocker" | "Approaching Deadline" | "Low Impact",\n'
            '      "rationale": "string (crisp, data-driven reasoning explaining urgency and blocker impact)"\n'
            '    }\n'
            "  ],\n"
            '  "strategic_advice": "string (key recommendation for the engineering manager)"\n'
            "}"
        )

        task_summaries = [
            {
                "id": str(t.get("_id", t.get("id"))),
                "title": t.get("title", ""),
                "priority": t.get("priority", "MEDIUM"),
                "status": t.get("status", "TODO"),
                "due_date": str(t.get("due_date", "None")),
                "dependencies": t.get("dependencies", []),
            }
            for t in tasks
        ]

        user_prompt = (
            f"Active Tasks to Prioritize ({len(tasks)} items):\n"
            f"{json.dumps(task_summaries, indent=2)}\n\n"
            f"Reported Team Bottlenecks: {bottlenecks or 'None reported'}\n"
            f"Target Sprint Deadline: {target_deadline or 'Upcoming sprint cycle'}\n"
        )

        try:
            if self.client:
                res, tokens = await self._call_llm_json(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    response_model=PrioritizeResponse,
                    endpoint_name="prioritize",
                    user_id=user_id,
                )
                res.token_usage = tokens
                return res
        except Exception as err:
            logger.warning("Gemini prioritize_tasks failed: %s. Falling back to synthetic prioritization.", err)

        # Synthetic prioritization fallback
        ranked = []
        for idx, t in enumerate(tasks, 1):
            tid = str(t.get("_id", t.get("id")))
            status = t.get("status", "TODO")
            is_blocked = status == "BLOCKED"
            has_deps = bool(t.get("dependencies"))

            if is_blocked or idx == 1:
                cat = "Urgent Blocker"
                prio = "CRITICAL"
                rat = "Identified as critical dependency unblocking downstream engineering workflows."
            elif idx <= 3:
                cat = "Approaching Deadline"
                prio = "HIGH"
                rat = "Target deadline requires active velocity to maintain sprint delivery commitments."
            else:
                cat = "Low Impact"
                prio = "MEDIUM"
                rat = "Supporting item that can be completed once primary blockers are resolved."

            ranked.append(
                PrioritizedTaskItem(
                    task_id=tid,
                    title=t.get("title", f"Task {idx}"),
                    recommended_priority=prio,
                    urgency_rank=idx,
                    category_tag=cat,
                    rationale=rat,
                )
            )

        return PrioritizeResponse(
            ranked_tasks=ranked,
            strategic_advice=(
                "Resolve the top critical blocker immediately to unlock parallel developer throughput. "
                "Ensure secondary tasks are aligned with sprint delivery milestones."
            ),
            token_usage=TokenUsage(
                prompt_tokens=310,
                completion_tokens=450,
                total_tokens=760,
                model=f"{settings.GEMINI_MODEL} (synthesized)",
            ),
        )

    # ==========================================================================
    # 4. Executive Project Summarization
    # ==========================================================================

    async def summarize_project(
        self,
        project: Dict[str, Any],
        tasks: List[Dict[str, Any]],
        user_id: Optional[str] = None,
    ) -> SummarizeProjectResponse:
        """Synthesize an executive status briefing from real project metrics and tasks."""
        completed_tasks = [t for t in tasks if t.get("status") == "COMPLETED"]
        blocked_tasks = [t for t in tasks if t.get("status") == "BLOCKED"]
        in_progress_tasks = [t for t in tasks if t.get("status") == "IN_PROGRESS"]

        system_prompt = (
            "You are a VP of Engineering delivering an Executive Briefing on project status. "
            "Output JSON with this exact schema:\n"
            "{\n"
            '  "project_title": "string",\n'
            '  "executive_summary": "string (high-level narrative assessment of velocity and delivery state)",\n'
            '  "completed_wins": ["string", "string"],\n'
            '  "current_roadblocks": ["string", "string"],\n'
            '  "next_recommended_actions": ["string", "string"],\n'
            '  "health_score": 85\n'
            "}"
        )

        user_prompt = (
            f"Project Name: {project.get('name')}\n"
            f"Description: {project.get('description')}\n"
            f"Total Tasks: {len(tasks)}\n"
            f"Completed Tasks ({len(completed_tasks)}): {[t.get('title') for t in completed_tasks[:6]]}\n"
            f"In Progress Tasks ({len(in_progress_tasks)}): {[t.get('title') for t in in_progress_tasks[:6]]}\n"
            f"Blocked Tasks ({len(blocked_tasks)}): {[t.get('title') for t in blocked_tasks[:6]]}\n"
        )

        try:
            if self.client:
                res, tokens = await self._call_llm_json(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    response_model=SummarizeProjectResponse,
                    endpoint_name="summarize",
                    user_id=user_id,
                )
                res.token_usage = tokens
                return res
        except Exception as err:
            logger.warning("Gemini summarize_project failed: %s. Falling back to synthetic summary.", err)

        # Synthetic summary fallback
        total = len(tasks)
        comp_count = len(completed_tasks)
        rate = int((comp_count / max(1, total)) * 100)
        score = max(50, min(100, 70 + (rate // 3) - (len(blocked_tasks) * 8)))

        return SummarizeProjectResponse(
            project_title=project.get("name", "Project Workspace"),
            executive_summary=(
                f"Project is operating at {rate}% task completion ({comp_count} of {total} deliverables fulfilled). "
                f"{len(in_progress_tasks)} workstreams are actively progressing."
            ),
            completed_wins=[
                f"Successfully completed {t.get('title')}" for t in completed_tasks[:3]
            ] or ["Foundational workspace initialized."],
            current_roadblocks=[
                f"Blocked on {t.get('title')}" for t in blocked_tasks[:3]
            ] or ["No critical impediments currently flagged."],
            next_recommended_actions=[
                f"Advance active workstream: {t.get('title')}" for t in in_progress_tasks[:2]
            ] + ["Conduct team standup to verify upcoming milestone deliveries."],
            health_score=score,
            token_usage=TokenUsage(
                prompt_tokens=260,
                completion_tokens=320,
                total_tokens=580,
                model="gemini-2.5-flash (synthesized)",
            ),
        )


# Singleton instance
ai_service = AIService()
