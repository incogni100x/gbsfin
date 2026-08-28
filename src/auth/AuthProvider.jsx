import { supabase } from "@/lib/supabase/client.js";
import { clearPersistedQueryCache } from "@/lib/queryClient.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./AuthContext.js";
import { getCurrentProfile } from "./profileService.js";

function AuthProvider({ children }) {
  const [loading, setLoading] = useState(Boolean(supabase));
  const [session, setSession] = useState(null);
  const [sessionVerified, setSessionVerified] = useState(false);
  const [profile, setProfile] = useState(null);

  const refreshProfile = useCallback(async () => {
    if (!supabase) {
      setProfile(null);
      return null;
    }

    const { profile: nextProfile } = await getCurrentProfile();
    setProfile(nextProfile);
    return nextProfile;
  }, []);

  const refreshVerification = useCallback(async () => {
    if (!supabase) {
      setSessionVerified(false);
      return false;
    }

    const { data, error } = await supabase.rpc(
      "is_current_session_verified",
    );
    const verified = !error && data === true;
    setSessionVerified(verified);
    return verified;
  }, []);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let active = true;
    let currentUserId = null;
    let initialized = false;
    let syncVersion = 0;

    const synchronizeSession = async (
      nextSession,
      { showLoading = false } = {},
    ) => {
      const currentVersion = ++syncVersion;

      if (showLoading) setLoading(true);
      setSession(nextSession);

      if (!nextSession) {
        currentUserId = null;
        initialized = true;
        setSessionVerified(false);
        setProfile(null);
        clearPersistedQueryCache();
        if (active && currentVersion === syncVersion) setLoading(false);
        return;
      }

      if (
        initialized &&
        currentUserId &&
        currentUserId !== nextSession.user.id
      ) {
        clearPersistedQueryCache();
      }

      const [verificationResult, profileResult] = await Promise.allSettled([
        supabase.rpc("is_current_session_verified"),
        getCurrentProfile(),
      ]);

      if (!active || currentVersion !== syncVersion) return;

      const verified =
        verificationResult.status === "fulfilled" &&
        !verificationResult.value.error &&
        verificationResult.value.data === true;
      const nextProfile =
        profileResult.status === "fulfilled"
          ? profileResult.value.profile
          : null;

      currentUserId = nextSession.user.id;
      initialized = true;
      setSessionVerified(verified);
      setProfile(nextProfile);
      setLoading(false);
    };

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      window.setTimeout(() => {
        if (!active) return;

        if (event === "TOKEN_REFRESHED") {
          setSession(nextSession);
          return;
        }

        if (event === "SIGNED_OUT") {
          void synchronizeSession(null);
          return;
        }

        if (
          event === "SIGNED_IN" &&
          initialized &&
          nextSession?.user.id === currentUserId
        ) {
          setSession(nextSession);
          return;
        }

        if (event === "USER_UPDATED" && nextSession) {
          setSession(nextSession);
          void refreshProfile();
          return;
        }

        void synchronizeSession(nextSession, {
          showLoading: !initialized || currentUserId !== nextSession?.user.id,
        });
      }, 0);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const value = useMemo(
    () => ({
      loading,
      profile,
      refreshProfile,
      refreshVerification,
      session,
      sessionVerified,
      user: session?.user ?? null,
    }),
    [
      loading,
      profile,
      refreshProfile,
      refreshVerification,
      session,
      sessionVerified,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
