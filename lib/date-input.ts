type PickerEnabledDateInput = HTMLInputElement & {
  showPicker?: () => void;
};

export function openNativeDateInputPicker(input: HTMLInputElement | null) {
  if (!input) {
    return;
  }

  input.focus();

  try {
    (input as PickerEnabledDateInput).showPicker?.();
  } catch {
    // Some browsers restrict picker opening to specific interaction contexts.
  }
}
