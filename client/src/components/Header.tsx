import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from "react";
import { login, logout, signup } from "../auth/oidc";

type AuthState = {
  status: string;
  user?: { profile?: { email?: string } };
  error?: string;
};

type HeaderProps = {
  auth: AuthState;
  menuOpen: boolean;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  menuRef: RefObject<HTMLDivElement>;
  onUploadInput: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function Header({ auth, menuOpen, setMenuOpen, menuRef, onUploadInput }: HeaderProps) {
  return (
    <header className="header">
      <div className="title">
        <h1>Open Photos</h1>
      </div>
      <div className="header-actions">
        <label
          className={`icon-button ${auth.status !== "authenticated" ? "disabled" : ""}`}
          title="Upload photos"
        >
          <input
            type="file"
            multiple
            onChange={onUploadInput}
            disabled={auth.status !== "authenticated"}
          />
          <span className="icon">+</span>
        </label>
        <div className="user-menu" ref={menuRef}>
          <button
            className="user-button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="user-avatar" />
          </button>
          {menuOpen && (
            <div className="menu" role="menu">
              {auth.status === "loading" && <div className="menu-item">Checking session...</div>}
              {auth.status === "error" && <div className="menu-item error">{auth.error}</div>}
              {auth.status === "anonymous" && (
                <>
                  <button className="menu-item" onClick={login}>
                    Sign in
                  </button>
                  <button className="menu-item" onClick={signup}>
                    Create account
                  </button>
                </>
              )}
              {auth.status === "authenticated" && (
                <>
                  <div className="menu-item muted">
                    {auth.user?.profile?.email || "Signed in"}
                  </div>
                  <button className="menu-item" onClick={logout}>
                    Sign out
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
