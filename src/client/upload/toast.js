/**
 * The small upload status card. One node per batch, replaced in place.
 * @module dsh-remote/client/upload/toast
 */

/**
 * @param {Document} document
 * @param {string} text
 * @returns {{set: (value: string) => void, error: () => void, remove: () => void}}
 */
function showUploadToast(document, text) {
  if (typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') {
    return { set() {}, error() {}, remove() {} }
  }
  const element = document.createElement('div')
  element.className = 'dshr-uploadToast'
  element.textContent = text
  document.body.appendChild(element)
  return {
    set(value) {
      element.textContent = value
    },
    error() {
      if (element.classList && typeof element.classList.add === 'function') element.classList.add('dshr-uploadToastError')
    },
    remove() {
      element.remove()
    },
  }
}

export { showUploadToast }
