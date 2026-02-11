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
  onFilterClick: () => void;
  filterActive: boolean;
};

export function Header({
  auth,
  menuOpen,
  setMenuOpen,
  menuRef,
  onUploadInput,
  onFilterClick,
  filterActive,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="title">
        <h1>Open Photos</h1>
      </div>
      <div className="header-actions">
        <button
          className={`icon-button ${filterActive ? "active" : ""}`}
          onClick={onFilterClick}
          title="Filter photos"
          aria-label="Filter photos"
          aria-pressed={filterActive}
        >
          <svg
            className="icon-svg"
            viewBox="0 0 24 24"
            role="img"
            aria-hidden="true"
          >
            <path
              d="M3 4h18l-7 8v6l-4 2v-8L3 4z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
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
