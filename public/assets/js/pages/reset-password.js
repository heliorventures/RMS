const resetToken = RMS.utils.queryParams().token;
const resetForm = document.getElementById('resetPasswordForm');

if (!resetToken) {
  const status = document.getElementById('resetStatus');
  status.textContent = 'Password reset link is invalid or incomplete.';
  status.classList.remove('d-none');
  status.classList.add('alert-danger');
  status.setAttribute('role', 'alert');
  document.getElementById('resetPasswordBtn').disabled = true;
}

resetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  if (newPassword.length < 12) {
    return RMS.mutations.showValidationError(resetForm, 'Password must be at least 12 characters.', '#newPassword');
  }
  if (newPassword !== confirmPassword) {
    return RMS.mutations.showValidationError(resetForm, 'Passwords do not match.', '#confirmPassword');
  }

  const result = await RMS.mutations.runMutation(
    event.currentTarget.querySelector('button[type="submit"]'),
    () => RMS.api.post('/auth/reset-password', { token: resetToken, newPassword }),
    {
      form: resetForm,
      statusTarget: '#resetStatus',
      errorTarget: '#resetStatus',
      pending: 'Resetting…',
      success: 'Password reset successfully. Sign in with your new password.'
    }
  );
  if (result.ok) {
    resetForm.querySelectorAll('input, button').forEach(element => { element.disabled = true; });
  }
});
