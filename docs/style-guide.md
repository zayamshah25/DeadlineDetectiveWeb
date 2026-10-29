# Web UI style guide

**App:** Deadline Detective. **Visual goal:** clear, readable academic task management.

- Main surfaces: light neutral background with dark text; optional dark theme.
- Suggested palette for documentation: primary `#2563EB`, accent `#14B8A6`, alert `#DC2626`; verify actual CSS values before calling these implemented colors.
- Font: system sans-serif. Suggested sizes: page title 28–32px; section heading 20–24px; body 14–16px; helper text 12–14px.
- Components: sidebar navigation, task cards/table rows, text inputs, date fields, primary/secondary buttons, badges, status labels.
- Icons: simple recognizable line icons paired with labels where possible.
- Accessibility target: WCAG AA contrast (4.5:1 normal text), visible keyboard focus, descriptive labels, readable status text in addition to color.

**Source of truth for implemented styling:** `client/src/App.css`, `client/src/index.css`, and `client/src/AuthScreen.css`.
