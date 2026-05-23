import { createContext, useContext, useRef, useState, ReactNode } from 'react';

const API = 'http://localhost:4000/api';

export interface UserProfile {
  username: string;
  displayName: string;
  bio: string;
  gravatarHash: string;
}

interface ProfileContextValue {
  getProfile: (username: string) => UserProfile | undefined;
  fetchProfile: (username: string) => void;
}

const ProfileContext = createContext<ProfileContextValue>({
  getProfile: () => undefined,
  fetchProfile: () => {},
});

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map());
  const inflight = useRef<Set<string>>(new Set());

  function fetchProfile(username: string) {
    if (!username || profiles.has(username) || inflight.current.has(username)) return;
    inflight.current.add(username);
    const token = localStorage.getItem('rtc-token');
    fetch(`${API}/users/${encodeURIComponent(username)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: UserProfile | null) => {
        inflight.current.delete(username);
        if (data) {
          setProfiles(prev => new Map(prev).set(username, data));
        }
      })
      .catch(() => { inflight.current.delete(username); });
  }

  function getProfile(username: string): UserProfile | undefined {
    fetchProfile(username);
    return profiles.get(username);
  }

  return (
    <ProfileContext.Provider value={{ getProfile, fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(username: string): UserProfile | undefined {
  const { getProfile } = useContext(ProfileContext);
  return getProfile(username);
}
