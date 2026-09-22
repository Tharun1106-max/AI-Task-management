"""Verification script for Groq to Google Generative AI SDK (Gemini) Migration."""

import asyncio
import json
import os
import sys
from unittest.mock import AsyncMock, MagicMock
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings
from app.services.ai_service import ai_service
from app.services.vector_service import vector_service, EMBEDDING_DIMENSION
from app.services.risk_service import risk_service
from app.schemas.ai import ProjectPlanResponse, GenerateTasksResponse, PrioritizeResponse, SummarizeProjectResponse


async def test_embeddings_and_dimensions():
    print("\n--- 1. Testing Embeddings & Vector Dimensions ---")
    assert EMBEDDING_DIMENSION == 768, f"Expected dimension 768, got {EMBEDDING_DIMENSION}"
    print("[PASS] EMBEDDING_DIMENSION is 768.")

    sample_text = "TaskPilot agile architecture roadmap with microservices and reactive UI."
    vec = vector_service.generate_embedding(sample_text)
    assert len(vec) == 768, f"Expected 768-dim vector, got {len(vec)}"
    print("[PASS] generate_embedding generated 768-dimensional vector.")

    batch_vecs = vector_service.generate_embeddings_batch([sample_text, "Another document chunk"])
    assert len(batch_vecs) == 2
    assert len(batch_vecs[0]) == 768
    assert len(batch_vecs[1]) == 768
    print("[PASS] generate_embeddings_batch generated 768-dimensional vectors.")

    sim = vector_service.cosine_similarity(vec, vec)
    assert abs(sim - 1.0) < 1e-4, f"Self similarity should be 1.0, got {sim}"
    print(f"[PASS] Cosine self-similarity is {sim:.4f}.")


async def test_ai_service_fallbacks():
    print("\n--- 2. Testing AI Service Synthesis & Fallbacks ---")
    settings = get_settings()

    # 1. Project Plan
    plan = await ai_service.generate_project_plan("Real-time Inventory Tracking System", "Logistics", 4)
    assert isinstance(plan, ProjectPlanResponse)
    assert len(plan.milestones) >= 4
    assert len(plan.tasks) >= 8
    assert "gemini" in plan.token_usage.model.lower()
    print(f"[PASS] Project plan generated: '{plan.title}' | Model: {plan.token_usage.model} | Tasks: {len(plan.tasks)}")

    # 2. Generate Tasks
    tasks_res = await ai_service.generate_tasks("Two-Factor Authentication", "FastAPI + React", 6)
    assert isinstance(tasks_res, GenerateTasksResponse)
    assert len(tasks_res.tasks) >= 5
    assert "gemini" in tasks_res.token_usage.model.lower()
    print(f"[PASS] Task quick-generator produced {len(tasks_res.tasks)} tasks | Model: {tasks_res.token_usage.model}")

    # 3. Prioritize Tasks
    dummy_tasks = [
        {"id": "t1", "title": "Setup OAuth2 Flow", "status": "BLOCKED", "priority": "HIGH"},
        {"id": "t2", "title": "Design Settings Screen", "status": "TODO", "priority": "LOW"},
    ]
    prio_res = await ai_service.prioritize_tasks(dummy_tasks, bottlenecks="OAuth credentials missing")
    assert isinstance(prio_res, PrioritizeResponse)
    assert len(prio_res.ranked_tasks) == 2
    assert "gemini" in prio_res.token_usage.model.lower()
    print(f"[PASS] Task prioritization completed | Model: {prio_res.token_usage.model}")

    # 4. Summarize Project
    dummy_project = {"name": "Warehouse Cloud", "description": "High-velocity inventory tracking"}
    summary_res = await ai_service.summarize_project(dummy_project, dummy_tasks)
    assert isinstance(summary_res, SummarizeProjectResponse)
    assert summary_res.health_score > 0
    assert "gemini" in summary_res.token_usage.model.lower()
    print(f"[PASS] Executive summary completed | Health score: {summary_res.health_score} | Model: {summary_res.token_usage.model}")


async def test_automatic_model_failover():
    print("\n--- 3. Testing Automatic Multi-Model Failover (Token Quota Exceeded) ---")
    settings = get_settings()

    # Create a mock Gemini client
    mock_client = MagicMock()
    mock_client.aio = MagicMock()
    mock_client.aio.models = MagicMock()

    class TestOutputSchema(BaseModel):
        status: str
        message: str

    call_count = {"count": 0, "models_called": []}

    async def mock_generate_content(model, contents, config):
        call_count["count"] += 1
        call_count["models_called"].append(model)
        # Simulate first 3 models in candidate list failing with quota/token limits
        if call_count["count"] < 3:
            raise Exception(f"google.genai.errors.APIError: 429 Resource exhausted (quota limit on {model})")
        else:
            # Next Gemini model succeeds
            mock_resp = MagicMock()
            mock_resp.text = json.dumps({"status": "SUCCESS", "message": f"Processed successfully by {model}"})
            mock_resp.parsed = None
            mock_resp.usage_metadata = MagicMock(
                prompt_token_count=150,
                candidates_token_count=80,
                total_token_count=230,
            )
            return mock_resp

    mock_client.aio.models.generate_content = mock_generate_content

    # Temporarily set mock client
    original_client = ai_service.client
    ai_service.client = mock_client

    try:
        res, token_usage = await ai_service._call_llm_json(
            system_prompt="You are an AI assistant.",
            user_prompt="Run diagnostics.",
            response_model=TestOutputSchema,
            endpoint_name="test-failover",
        )

        assert res.status == "SUCCESS"
        assert len(call_count["models_called"]) == 3
        succeeded_model = call_count["models_called"][-1]
        assert token_usage.model == succeeded_model
        assert token_usage.total_tokens == 230
        print(f"[PASS] Universal model failover cascade successfully tested:")
        print(f"       Failed models rotated: {call_count['models_called'][:-1]}")
        print(f"       Automatically switched to healthy model: {succeeded_model}")
        print(f"       Recorded telemetry model: {token_usage.model} ({token_usage.total_tokens} tokens)")
        print(f"       Active preferred model updated to: {ai_service._preferred_model}")

    finally:
        ai_service.client = original_client


async def test_risk_service_and_rag():
    print("\n--- 4. Testing Risk Service & RAG Query Pipeline ---")
    risk_res = await risk_service.analyze_project_risks("nonexistent_id")
    assert risk_res.risk_level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    print(f"[PASS] Risk analysis completed | Score: {risk_res.overall_risk_score} | Level: {risk_res.risk_level}")

    rag_res = await vector_service.answer_rag_query("dummy_proj", "What is the auth architecture?")
    assert rag_res.question == "What is the auth architecture?"
    assert rag_res.answer != ""
    print(f"[PASS] RAG answer query completed | Answer excerpt: '{rag_res.answer[:80]}...'")


async def main():
    print("=" * 70)
    print("TASKPILOT: GOOGLE GENERATIVE AI (GEMINI) MIGRATION VERIFICATION")
    print("=" * 70)
    await test_embeddings_and_dimensions()
    await test_ai_service_fallbacks()
    await test_automatic_model_failover()
    await test_risk_service_and_rag()
    print("\n" + "=" * 70)
    print("ALL VERIFICATION SUITES PASSED CLEANLY!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
