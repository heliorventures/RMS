window.RMS = window.RMS || {};

(() => {
  const pendingTargets = new WeakSet();
  let statusSequence = 0;

  function resolveElement(value) {
    if (!value) return null;
    if (typeof value === 'string') return document.querySelector(value);
    if (value instanceof Element) return value;
    return value.currentTarget instanceof Element ? value.currentTarget : null;
  }

  function resolveButton(value) {
    const element = resolveElement(value);
    if (element instanceof HTMLButtonElement) return element;
    return document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
  }

  function resolveForm(value, button) {
    return resolveElement(value) || button?.closest('form') || null;
  }

  function createFormStatus(form) {
    let status = form.querySelector(':scope > .mutation-form-status');
    if (status) return status;
    status = document.createElement('div');
    status.className = 'mutation-form-status alert py-2 small d-none';
    form.prepend(status);
    return status;
  }

  function resolveStatusTarget(value, form, createForForm = false) {
    return resolveElement(value) || (createForForm && form ? createFormStatus(form) : null);
  }

  function setStatus(target, message, type) {
    if (!target || !message) return;
    const isError = type === 'error';
    target.textContent = message;
    target.classList.remove('d-none', 'alert-info', 'alert-success', 'alert-danger');
    target.classList.add('alert', 'py-2', 'small', isError ? 'alert-danger' : (type === 'success' ? 'alert-success' : 'alert-info'));
    target.setAttribute('role', isError ? 'alert' : 'status');
    target.setAttribute('aria-live', isError ? 'assertive' : 'polite');
    target.setAttribute('aria-atomic', 'true');
  }

  function clearStatus(target) {
    if (!target) return;
    target.textContent = '';
    target.classList.add('d-none');
    target.removeAttribute('role');
    target.removeAttribute('aria-live');
    target.removeAttribute('aria-atomic');
  }

  function clearFormErrors(form) {
    if (!form) return;
    form.querySelectorAll('[aria-invalid="true"]').forEach(field => {
      field.removeAttribute('aria-invalid');
      const describedBy = (field.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter(id => id && !id.startsWith('mutation-error-'));
      if (describedBy.length) field.setAttribute('aria-describedby', describedBy.join(' '));
      else field.removeAttribute('aria-describedby');
    });
    form.querySelectorAll('.mutation-field-error').forEach(error => error.remove());
    clearStatus(form.querySelector(':scope > .mutation-form-status'));
  }

  function showValidationError(formValue, message, fieldValue) {
    const form = resolveElement(formValue);
    const field = resolveElement(fieldValue);
    clearFormErrors(form);

    if (field) {
      const error = document.createElement('div');
      error.id = `mutation-error-${++statusSequence}`;
      error.className = 'mutation-field-error invalid-feedback d-block';
      error.textContent = message;
      error.setAttribute('role', 'alert');
      field.setAttribute('aria-invalid', 'true');
      const describedBy = [field.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' ');
      field.setAttribute('aria-describedby', describedBy);
      field.insertAdjacentElement('afterend', error);
      field.focus();
      return false;
    }

    const target = form ? createFormStatus(form) : null;
    if (target) setStatus(target, message, 'error');
    else window.RMS.toast.show(message, 'error');
    return false;
  }

  function messageValue(value, payload) {
    return typeof value === 'function' ? value(payload) : value;
  }

  async function runMutation(buttonValue, operation, messages = {}) {
    const button = resolveButton(buttonValue);
    const form = resolveForm(messages.form, button);
    const guard = button || form;
    if (guard && pendingTargets.has(guard)) return { ok: false, duplicate: true };

    const statusTarget = resolveStatusTarget(messages.statusTarget, form, false);
    const errorTarget = resolveStatusTarget(messages.errorTarget, form, Boolean(form));
    const originalButton = button ? {
      disabled: button.disabled,
      html: button.innerHTML,
      ariaBusy: button.getAttribute('aria-busy')
    } : null;

    if (guard) pendingTargets.add(guard);
    clearStatus(statusTarget);
    if (errorTarget !== statusTarget) clearStatus(errorTarget);
    if (form) clearFormErrors(form);

    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      if (messages.pending) button.textContent = messageValue(messages.pending);
    }
    if (statusTarget && messages.pending) setStatus(statusTarget, messageValue(messages.pending), 'pending');

    try {
      const value = await operation();
      const successMessage = messageValue(messages.success, value);
      if (successMessage) {
        if (statusTarget) setStatus(statusTarget, successMessage, 'success');
        else window.RMS.toast.show(successMessage, 'success');
      }
      return { ok: true, value };
    } catch (error) {
      const errorMessage = messageValue(messages.error, error) || error?.message || 'The action could not be completed. Please try again.';
      const target = errorTarget || statusTarget;
      if (target) setStatus(target, errorMessage, 'error');
      else window.RMS.toast.show(errorMessage, 'error');
      return { ok: false, error };
    } finally {
      if (button && originalButton) {
        button.disabled = originalButton.disabled;
        button.innerHTML = originalButton.html;
        if (originalButton.ariaBusy === null) button.removeAttribute('aria-busy');
        else button.setAttribute('aria-busy', originalButton.ariaBusy);
        if (!button.disabled && button.isConnected && button.getClientRects().length) button.focus();
      }
      if (guard) pendingTargets.delete(guard);
    }
  }

  window.RMS.mutations = {
    runMutation,
    clearFormErrors,
    showValidationError
  };
})();
