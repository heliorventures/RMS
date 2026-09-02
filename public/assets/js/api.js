class ApiError extends Error {
  constructor(message, { status = 0, code = 'API_ERROR', requestId = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

window.RMS.ApiError = ApiError;

window.RMS.api = {
  baseUrl: '',
  timeout: 15_000,

  async _fetch(endpoint, options = {}) {
    const isAuthRoute = endpoint.startsWith('/auth/login');
    const {
      timeout = this.timeout,
      signal: externalSignal,
      headers: optionHeaders,
      ...fetchOptions
    } = options;
    const controller = new AbortController();
    let timedOut = false;
    let timeoutId = null;
    const abortFromExternalSignal = () => controller.abort(externalSignal?.reason);

    if (externalSignal) {
      if (externalSignal.aborted) abortFromExternalSignal();
      else externalSignal.addEventListener('abort', abortFromExternalSignal, { once: true });
    }

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeout);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          ...window.RMS.auth.headers(),
          ...(optionHeaders || {})
        }
      });
      const requestId = response.headers.get('x-request-id');
      const responseText = await response.text();
      let data = {};

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch (cause) {
          throw new ApiError('Server returned an invalid response. Please try again.', {
            status: response.status,
            code: 'INVALID_RESPONSE',
            requestId,
            cause
          });
        }
      }

      if (!response.ok || data?.success === false) {
        const error = new ApiError(data?.message || this._messageForStatus(response.status), {
          status: response.status,
          code: data?.code || `HTTP_${response.status}`,
          requestId: data?.requestId || requestId
        });
        if (response.status === 401 && !isAuthRoute) window.RMS.auth.logout();
        throw error;
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (timedOut) {
        throw new ApiError('Request timed out. Please try again.', {
          code: 'TIMEOUT',
          cause: error
        });
      }
      if (externalSignal?.aborted) {
        throw new ApiError('Request was cancelled.', {
          code: 'REQUEST_ABORTED',
          cause: error
        });
      }
      throw new ApiError('Server is unavailable. Check your connection and try again.', {
        code: 'NETWORK_ERROR',
        cause: error
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', abortFromExternalSignal);
    }
  },

  _messageForStatus(status) {
    const messages = {
      400: 'Check the entered information and try again.',
      401: 'Your session has expired. Sign in again.',
      403: 'You do not have permission to perform this action.',
      404: 'The requested item could not be found.',
      409: 'This item changed or conflicts with existing data. Refresh and try again.',
      429: 'Too many requests. Wait a moment and try again.'
    };
    return messages[status] || 'The request could not be completed. Please try again.';
  },

  get: (endpoint, options) => window.RMS.api._fetch(endpoint, options),
  post: (endpoint, body, options = {}) => window.RMS.api._fetch(endpoint, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body)
  }),
  put: (endpoint, body, options = {}) => window.RMS.api._fetch(endpoint, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body)
  }),
  delete: (endpoint, options = {}) => window.RMS.api._fetch(endpoint, {
    ...options,
    method: 'DELETE'
  })
};
