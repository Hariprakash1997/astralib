import { html } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

function icon(paths: string, size = 16) {
  return html`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="alx-icon">${unsafeSVG(paths)}</svg>`;
}

export const iconEdit = (size?: number) => icon('<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>', size);

export const iconDelete = (size?: number) => icon('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>', size);

export const iconClose = (size?: number) => icon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', size);

export const iconClone = (size?: number) => icon('<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', size);

export const iconPlus = (size?: number) => icon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', size);

export const iconRefresh = (size?: number) => icon('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>', size);

export const iconConnect = (size?: number) => icon('<path d="M15 7h3a5 5 0 0 1 0 10h-3"/><path d="M9 17H6a5 5 0 0 1 0-10h3"/><line x1="8" y1="12" x2="16" y2="12"/>', size);

export const iconDisconnect = (size?: number) => icon('<path d="M15 7h3a5 5 0 0 1 0 10h-3"/><path d="M9 17H6a5 5 0 0 1 0-10h3"/>', size);

export const iconSync = (size?: number) => icon('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>', size);

export const iconSearch = (size?: number) => icon('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>', size);

export const iconSend = (size?: number) => icon('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>', size);

export const iconFilter = (size?: number) => icon('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>', size);

export const iconChevronLeft = (size?: number) => icon('<polyline points="15 18 9 12 15 6"/>', size);

export const iconChevronRight = (size?: number) => icon('<polyline points="9 18 15 12 9 6"/>', size);

export const iconCheck = (size?: number) => icon('<polyline points="20 6 9 17 4 12"/>', size);

export const iconWarning = (size?: number) => icon('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', size);

export const iconPlay = (size?: number) => icon('<polygon points="5 3 19 12 5 21 5 3"/>', size);

export const iconPause = (size?: number) => icon('<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>', size);
