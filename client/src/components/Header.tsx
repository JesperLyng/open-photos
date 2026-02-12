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
  onToggleFavoriteFilter: () => void;
  favoriteFilterActive: boolean;
};

export function Header({
  auth,
  menuOpen,
  setMenuOpen,
  menuRef,
  onUploadInput,
  onFilterClick,
  filterActive,
  onToggleFavoriteFilter,
  favoriteFilterActive,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="title">
        <h1>Open Photos</h1>
      </div>
      <div className="header-actions">
        <button
          className={`icon-button favorite-toggle ${favoriteFilterActive ? "active" : ""}`}
          onClick={onToggleFavoriteFilter}
          title={favoriteFilterActive ? "Show all photos" : "Show favorites only"}
          aria-label={favoriteFilterActive ? "Show all photos" : "Show favorites only"}
          aria-pressed={favoriteFilterActive}
          type="button"
        >
          <svg className="heart-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 20.5l-1.4-1.3C6.2 15.3 3 12.4 3 8.9 3 6.6 4.8 5 7 5c1.5 0 3 .7 4 1.9C12 5.7 13.5 5 15 5c2.2 0 4 1.6 4 3.9 0 3.5-3.2 6.4-7.6 10.3L12 20.5z"
              fill="currentColor"
            />
          </svg>
        </button>
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
