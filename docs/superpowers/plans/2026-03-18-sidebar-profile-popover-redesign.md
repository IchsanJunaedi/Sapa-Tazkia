# Sidebar Profile Popover Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the bottom-left profile popover in the sidebar to resemble ChatGPT's UX — with account info, a Help item (with flyout sub-menu), and move Settings from the sidebar header into this popover.

**Architecture:** Extract the profile popover into a standalone `ProfilePopover.jsx` component (dark-themed), replace the inline popover markup in `SideBar.jsx` with it, and remove the now-redundant settings button from the sidebar top header (desktop + mobile).

**Tech Stack:** React 19, Tailwind CSS, lucide-react (icons already installed)

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `frontend/src/components/layout/ProfilePopover.jsx` | Self-contained dark-themed popover with Help flyout sub-menu |
| Modify | `frontend/src/components/layout/SideBar.jsx` | Import & render `<ProfilePopover>`, remove inline popover JSX, remove top Settings button (desktop + mobile) |

---

## Task 1: Create `ProfilePopover.jsx`

**Files:**
- Create: `frontend/src/components/layout/ProfilePopover.jsx`

This component receives all the data it needs as props and manages its own `helpOpen` local state for the flyout.

### Props interface
```jsx
<ProfilePopover
  getUserName={fn}             // () => string — returns display name
  getUserEmail={fn}            // () => string — returns email string
  position={{ x, y }}         // absolute pixel coords (fixed positioning)
  onLogout={fn}                // existing logout handler
  onSettingsClick={fn}         // existing settings handler (moved from header)
  onClose={fn}                 // close/hide popover
/>
```

- [ ] **Step 1: Create the file with the full component**

Create `frontend/src/components/layout/ProfilePopover.jsx` with the following content:

```jsx
import React, { useState } from 'react';
import { LogOut, HelpCircle, ChevronRight, Settings } from 'lucide-react';

const HELP_ITEMS = [
  { label: 'Help center' },
  { label: 'Terms & policies' },
  { label: 'Team dev' },
  { label: 'Report a bug' },
];

export default function ProfilePopover({
  getUserName,
  getUserEmail,
  position,
  onLogout,
  onSettingsClick,
  onClose,
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      {/* Backdrop — closes popover on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Main popover */}
      <div
        className="fixed z-50 w-64 rounded-xl shadow-2xl border border-white/10 bg-[#1e2a4a] text-white"
        style={{ left: `${position.x}px`, top: `${position.y - 10}px` }}
      >
        {/* Account info */}
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-sm font-semibold truncate">{getUserName()}</p>
          <p className="text-xs text-gray-400 truncate mt-0.5">{getUserEmail()}</p>
        </div>

        {/* Menu items */}
        <div className="p-1.5 space-y-0.5">

          {/* Settings */}
          <button
            onClick={() => { onSettingsClick(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-white/10"
          >
            <Settings size={15} className="text-gray-300" />
            <span>Settings</span>
          </button>

          {/* Help — with flyout on hover */}
          <div
            className="relative"
            onMouseEnter={() => setHelpOpen(true)}
            onMouseLeave={() => setHelpOpen(false)}
          >
            <button
              onClick={() => setHelpOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-white/10"
            >
              <HelpCircle size={15} className="text-gray-300" />
              <span className="flex-1 text-left">Help</span>
              <ChevronRight size={14} className="text-gray-400" />
            </button>

            {/* Flyout sub-menu — positioned to the right of the main popover */}
            {helpOpen && (
              <div
                className="absolute top-0 w-52 rounded-xl shadow-2xl border border-white/10 bg-[#1e2a4a] p-1.5"
                style={{ left: '100%', marginLeft: '4px', zIndex: 60 }}
              >
                {HELP_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors hover:bg-white/10"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Log out */}
        <div className="p-1.5 border-t border-white/10">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors text-red-400 hover:bg-red-500/10"
          >
            <LogOut size={15} />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </>
  );
}
```

Key decisions:
- Flyout uses `style={{ zIndex: 60 }}` (inline) instead of Tailwind `z-60` which is not a standard v3 utility and would be silently dropped.
- Both the main popover (`z-50`) and backdrop (`z-40`) use standard Tailwind values.
- The parent `<div>` for the Help item has no `overflow: hidden`, so the flyout can extend outside the popover bounds.

- [ ] **Step 2: Verify the file was written**

```bash
ls frontend/src/components/layout/ProfilePopover.jsx
```
Expected: file path is printed (no "No such file" error)

---

## Task 2: Integrate `ProfilePopover` into `SideBar.jsx`

**Files:**
- Modify: `frontend/src/components/layout/SideBar.jsx`

### Sub-step 2a — Add import

- [ ] **Step 3: Add ProfilePopover import**

In `SideBar.jsx` find the lucide-react import (line 2):

```js
import { PenSquare, User, Settings, Trash2, MoreHorizontal, LogOut, ChevronDown, ChevronRight, Loader2, Menu, X } from 'lucide-react';
```

Add the following line immediately after it:

```js
import ProfilePopover from './ProfilePopover';
```

### Sub-step 2b — Replace the inline profile popover block

- [ ] **Step 4: Replace the inline profile popover with `<ProfilePopover>`**

Locate and replace this **exact** block (lines 362–383 of `SideBar.jsx`):

```jsx
      {isProfilePopupVisible && user && (
        <>
          <div className="fixed inset-0 z-40" onClick={handleCloseAllPopups} />
          <div className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 w-64" style={{ left: `${popupPosition.x}px`, top: `${popupPosition.y - 10}px` }}>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-[#172c66] rounded-full flex items-center justify-center"><User size={20} className="text-white" /></div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800 truncate">{getUserName()}</h3>
                  <p className="text-xs text-gray-500 truncate">{getUserEmail()}</p>
                </div>
              </div>
              <div className="text-xs text-gray-400">{getUserNIM()}</div>
            </div>
            <div className="p-2">
              <button onClick={handleLogout} disabled={isStartingNewChat || isDeleting} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors text-red-600 hover:bg-red-50">
                <LogOut size={16} /> <span>Log out</span>
              </button>
            </div>
          </div>
        </>
      )}
```

Replace with:

```jsx
      {isProfilePopupVisible && user && (
        <ProfilePopover
          getUserName={getUserName}
          getUserEmail={getUserEmail}
          position={popupPosition}
          onLogout={handleLogout}
          onSettingsClick={onSettingsClick}
          onClose={handleCloseAllPopups}
        />
      )}
```

### Sub-step 2c — Remove desktop Settings button

- [ ] **Step 5: Remove the desktop Settings button from the sidebar header**

Locate this exact block in `SideBar.jsx` (lines ~172–179):

```jsx
            <button
              className="p-2 rounded-xl text-white/70 hover:bg-white/10 transition-colors flex items-center gap-3"
              title="Settings"
              onClick={onSettingsClick}
              disabled={isStartingNewChat || isDeleting}
            >
              <Settings size={24} />
            </button>
```

Delete the entire `<button>` element (all 7 lines above).

### Sub-step 2d — Remove mobile Settings button

- [ ] **Step 6: Remove the mobile Settings button from the mobile sidebar header**

Locate this exact block in `SideBar.jsx` (lines ~398–404):

```jsx
              <button
                className="p-2 rounded-xl text-white/70 hover:bg-white/10 transition-colors"
                title="Settings"
                onClick={onSettingsClick}
              >
                <Settings size={24} />
              </button>
```

Delete the entire `<button>` element (all 6 lines above).

### Sub-step 2e — Remove unused `Settings` import from lucide-react

- [ ] **Step 7: Remove `Settings` from the lucide-react import**

After deleting both Settings buttons, `Settings` is no longer used in `SideBar.jsx`. Find this line (line 2):

```js
import { PenSquare, User, Settings, Trash2, MoreHorizontal, LogOut, ChevronDown, ChevronRight, Loader2, Menu, X } from 'lucide-react';
```

Replace with:

```js
import { PenSquare, User, Trash2, MoreHorizontal, LogOut, ChevronDown, ChevronRight, Loader2, Menu, X } from 'lucide-react';
```

---

## Task 3: Visual QA

- [ ] **Step 8: Start the dev server**

```bash
cd E:/sapa-tazkia/frontend && npm start
```

Wait for compilation success.

- [ ] **Step 9: Verify popover on expanded sidebar**

With the sidebar fully open (not collapsed):
- [ ] Profile button still shows user name in bottom-left of sidebar
- [ ] Clicking opens the dark blue popover (`bg-[#1e2a4a]`)
- [ ] Top section shows name (bold) and email (muted)
- [ ] "Settings" menu item is present with gear icon
- [ ] "Help" menu item is present with help icon and `>` chevron on the right
- [ ] "Log out" is at the bottom with red text
- [ ] No Settings icon in the top-left header of the sidebar

- [ ] **Step 10: Verify Help flyout**

- [ ] Hovering over "Help" reveals a flyout panel to the right
- [ ] Flyout contains: Help center, Terms & policies, Team dev, Report a bug
- [ ] Each item highlights on hover
- [ ] Flyout does NOT disappear when moving mouse from Help button to flyout panel (hover area is continuous)
- [ ] Flyout is not clipped by the sidebar's overflow

- [ ] **Step 11: Verify close behavior**

- [ ] Clicking the backdrop (outside popover) closes it
- [ ] Clicking "Settings" fires the callback and closes popover
- [ ] Clicking "Log out" logs the user out

- [ ] **Step 12: Verify collapsed sidebar (expected behavior)**

Collapse the sidebar. Click the profile icon button. **Expected: nothing happens** (popover does NOT open when sidebar is collapsed — this is existing intended behavior in `handleProfileClick` at line 93 of `SideBar.jsx`).

- [ ] **Step 13: Verify mobile**

Resize browser to mobile width. Open the mobile sidebar. Confirm there is NO Settings icon in the mobile sidebar header. Click the profile button. Popover should open. On mobile, the Help flyout (`left: 100%`) may extend off-screen — this is an acceptable known limitation; document if observed.

---

## Task 4: Commit

- [ ] **Step 14: Commit the changes**

```bash
cd E:/sapa-tazkia
git add frontend/src/components/layout/ProfilePopover.jsx \
        frontend/src/components/layout/SideBar.jsx
git commit -m "feat: redesign sidebar profile popover with Help flyout and Settings entry

- Extract ProfilePopover into standalone dark-themed component
- Add account info (name + email) at top of popover
- Add Settings item (moved from sidebar header icon)
- Add Help item with flyout sub-menu: Help center, Terms & policies, Team dev, Report a bug
- Keep Log out at bottom with red accent
- Remove Settings icon button from desktop + mobile sidebar header

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Notes

### Why inline `zIndex: 60` on the flyout
Tailwind CSS v3 does not include `z-60` as a pre-built utility. Using `z-60` in a className would be silently ignored, leaving the flyout at `z-auto` (rendered below the `z-40` backdrop and potentially unclickable). The flyout uses `style={{ zIndex: 60 }}` to avoid this.

### Collapsed sidebar — no popover
When the sidebar is collapsed (`isSidebarOpen === false`), `handleProfileClick` returns early at line 93 of `SideBar.jsx`. This is intentional existing behavior; the popover is only accessible when the sidebar is expanded.

### NIM display intentionally removed
The old popover showed `getUserNIM()` (student ID number) below the email. The new popover shows only name and email, matching the spec ("Account Info: name and email"). NIM is intentionally dropped from the account info header.

### Mobile flyout off-screen
On narrow viewports, the flyout uses `left: 100%` which may push it partially off-screen to the right. Acceptable for v1. A future improvement could flip the flyout to `right: 100%` when the viewport is narrow.
