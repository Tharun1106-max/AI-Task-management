
import React, { useState, useEffect } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { User, Shield, KeyRound, CheckCircle2, AlertCircle, Save } from "lucide-react";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuth();

  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");

  // Profile form state
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setAvatarUrl(user.avatar_url || "");
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
    setIsUpdatingProfile(true);

    try {
      await updateUser({
        full_name: fullName,
        avatar_url: avatarUrl || undefined,
      });
      setProfileSuccessMsg("Profile updated successfully.");
      setTimeout(() => setProfileSuccessMsg(null), 3000);
    } catch (err: any) {
      setProfileErrorMsg(
        err.response?.data?.error?.message || "Failed to update profile."
      );
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccessMsg(null);
    setPasswordErrorMsg(null);

    if (newPassword.length < 8) {
      setPasswordErrorMsg("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg("New passwords do not match.");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      await authService.updatePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccessMsg("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccessMsg(null), 3000);
    } catch (err: any) {
      setPasswordErrorMsg(
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        "Failed to update password."
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <User className="h-5 w-5 text-indigo-400" />
          Account & Profile Settings
        </span>
      }
      description={`Manage profile information and security credentials for ${user?.email || ""}`}
    >
      <div className="space-y-6 pt-2">
        {/* Tab switcher */}
        <div className="flex rounded-xl bg-slate-950/60 p-1 border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === "profile"
                ? "bg-indigo-600/80 text-white shadow-sm border border-indigo-400/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Profile Information
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("password")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === "password"
                ? "bg-indigo-600/80 text-white shadow-sm border border-indigo-400/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Change Password
          </button>
        </div>

        {activeTab === "profile" ? (
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            {profileSuccessMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}
            {profileErrorMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{profileErrorMsg}</span>
              </div>
            )}

            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
            />

            <Input
              label="Avatar Image URL (optional)"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
            />

            <div className="rounded-xl bg-slate-950/40 border border-white/5 p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Shield className="h-4 w-4 text-indigo-400" />
                <span>Current Role:</span>
              </div>
              <span className="font-semibold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {user?.role || "MEMBER"}
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                glow
                isLoading={isUpdatingProfile}
                leftIcon={<Save className="h-4 w-4" />}
              >
                Save Changes
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {passwordSuccessMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{passwordSuccessMsg}</span>
              </div>
            )}
            {passwordErrorMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{passwordErrorMsg}</span>
              </div>
            )}

            <Input
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              required
            />

            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                glow
                isLoading={isUpdatingPassword}
                leftIcon={<KeyRound className="h-4 w-4" />}
              >
                Update Password
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
