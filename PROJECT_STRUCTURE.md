# The Sovereign Archive: Architecture & Logic

This document outlines the UI logic and architecture for the **Sovereign Archive Layout**.

## 1. UI Button to State Mapping

### Category Filters (Sidebar/Right Column)
- **Component**: `App.tsx`
- **Logic**: Each category button in the sidebar triggers `setSelectedCategory(id)`. 
- **State Interface**:
  - `selectedCategory`: Stores the currently active category ID (string) or `null` for "All Categories".
  - The UI updates dynamically based on this selection using a `useMemo` filter.

### Search Functionality
- **Component**: `App.tsx` (Search Bar)
- **Logic**: The `input` field is linked to `searchQuery` state via `onChange`.
- **User Feedback**: As the user types, the `articles` list is filtered in real-time.

### Admin Navigation
- **Component**: `App.tsx` (Admin Button)
- **Logic**: Uses `react-router-dom`'s `Link` to navigate to `/admin`. This button is only visible to authenticated authorized users.
- **Persistent Entry**: A secondary "Admin Panel" link is provided in the footer for consistent access across different scroll positions.

## 2. Sorting & Filtering Functions

### Date Sorting
- **Function**: Located inside the `useMemo` block in `src/App.tsx`.
- **Formula**: `list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))`.
- **Outcome**: Ensures that the "Latest Articles" section always displays the most recent documents at the top.

### Multi-Layer Filtering
- **Logic**: The `articles` variable in `App.tsx` is compute-derived based on three dependencies: `[data, searchQuery, selectedCategory]`.
- **Layer 1**: Category filter (if selected).
- **Layer 2**: Text search within title or content.
- **Layer 3**: Automatic sorting by timestamp.

## 3. Dynamic Hero Image Management

### Variable Storage
- **Source of Truth**: The `siteConfig.mainHeaderImage` variable within the global data object.
- **Initialization**: On site load, `App.tsx` fetches this configuration from the `/api/data` endpoint.
- **Default Fallback**: If no image is provided in the admin panel, the system uses a high-quality monochromatic placeholder from Unsplash.

### Admin Control Panel (Dashboard)
- **Updating the Image**: In the `AdminPanel.tsx`, the "Site Settings" section contains a field labeled **Hero Image URL**. 
- **Effect**: Changing this URL and clicking "تحديث إعدادات الموقع" sends a POST request to update the database JSON on the server, which in turn refreshes the live site for all users.

## 4. Dual-Level Admin System Architecture

### Tier 1: Sovereign Owner (hady.finianos@gmail.com)
- **Permissions**: Full access to all modules.
- **Exclusive Modules**: 
  - **Staff Management**: Can add or remove authorized admin emails.
  - **System Settings**: Can modify global site configuration (Title, Description, Hero Image).
- **Verification**: Uses the `MASTER_ADMINS` constant in `src/lib/supabase.ts`.

### Tier 2: Authorized Admins
- **Permissions**: Limited to **Content Management**.
- **Module Access**: Can publish, edit, or delete articles and manage categories.
- **Privacy Gates**: These admins cannot see the 'Staff' list or access 'System Settings'. They are kept isolated from the core infrastructure configuration.

### UI Implementation
- **Layout**: A dedicated **Tiered Partition System**. 
  - **Standard View**: Always defaults to "Content Management".
  - **The Sovereign Chamber**: A hidden link at the base of the sidebar (Sovereign only) that swaps the entire interface to reveal the System and Staff tools.
  - **The Design Suite**: A new module inside the Sovereign Chamber for managing global site identity.
    - **Branding**: Change Site Title and Hero Image (with instant preview).
    - **Sovereign Palette**: Real-time color control for Site Background, Font Colors, and Action Buttons.

- **Future Storage Path**: The "Add Article" module is configured for **Direct-to-GitHub** integration, with UI structures ready for PDF and header image binary uploads.
- **Security**: Strict conditional logic ensures that the "Sovereign Chamber" link and its related underlying state (`viewMode === 'sovereign'`) are physically excluded from the DOM for general admins.

---
*Note: This layout prioritizes aesthetics and rapid content access using minimalist architectural principles.*
