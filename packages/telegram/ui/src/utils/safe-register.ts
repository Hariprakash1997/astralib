/**
 * Safely registers a custom element, skipping if already defined.
 * Prevents DOMException when the same module is loaded multiple times.
 */
export function safeRegister(tagName: string, elementClass: CustomElementConstructor): void {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, elementClass);
  }
}
