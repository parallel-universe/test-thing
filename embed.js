/* eslint-disable */
var goEmbed = (function () {
    var url,
        submitButtonPendingText,
        redirectUrl,
        originalSubmitText,
        overrideStartingPackageRef,
        gaLinkerParam;

    var formElements = {};
    var formFields = {
        submitButton: {
            selector: '.js-go-form-submit',
            elementType: 'button',
            validationText: 'A submit button must be present with the class js-go-form-submit',
        },
        termsCheckbox: {
            selector: '.js-terms-checkbox',
            elementType: 'input',
            validationText: 'A terms checkbox must be present with the class js-terms-checkbox',
        },
        newsletterCheckbox: {
            selector: '.js-newsletter-checkbox',
            elementType: 'input',
            validationText: 'A newsletter checkbox must be present with the class js-newsletter-checkbox',
        },
        activationCodeInput: {
            selector: '.js-activation-code-input',
            elementType: 'input',
            validationText: 'An activation code input must be present with the class js-activation-code-input',
            voucherField: true,
        },
        // This key is especially named to match the api
        activation_codeErrorContainer: {
            selector: '.js-error-activation-code',
            elementType: 'div',
            validationText: 'A div must be present for the activation code field errors with the class js-error-activation-code',
            voucherField: true,
        },
        emailField: {
            selector: '.js-email-input',
            elementType: 'input',
            validationText: 'An email input must be present with the class js-email-input',
        },
        emailErrorContainer: {
            selector: '.js-error-email',
            elementType: 'div',
            validationText: 'A div must be present for the email field errors with the class js-error-email',
        },
        passwordField: {
            selector: '.js-password-input',
            elementType: 'input',
            validationText: 'A password input must be present with the class js-password-input',
        },
        passwordErrorContainer: {
            selector: '.js-error-password',
            elementType: 'div',
            validationText: 'A div must be present for the password field errors with the class js-error-password',
        }
    };

    function initialiseForm(suppliedUrl, suppliedOptions) {
        options = suppliedOptions || {};
        url = suppliedUrl;
        submitButtonPendingText = options.submitButtonPendingText || 'Activating...';
        redirectUrl = options.redirectUrl || null;
        overrideStartingPackageRef = options.overrideStartingPackageRef || null;

        document.addEventListener('DOMContentLoaded', function() {
            _cacheFormElements();
            _prefillActivationCodeFromQueryString();
            _addTermsCheckboxEventListener();
            _addSubmitEventListener();
            _enableSubmitButtonIfTermsAgreed();
        });
    }

    function _cacheFormElements() {
        for (var formField in formFields) {
            formElements[formField] = document.querySelector(formFields[formField].selector);
        }
        _validateFormState();
        originalSubmitText = formElements.submitButton.innerText;
    }

    function _hasVoucherField() {
        return formElements.activationCodeInput;
    }

    function _validateFormState() {
        _throwErrorIfUrlNotSupplied();
    
        for (var formField in formFields) {
            if (formFields[formField].voucherField && !_hasVoucherField()) continue;
            _throwErrorIfElementNotFound(formElements[formField], formFields[formField]);
        }
    }

    function _throwErrorIfUrlNotSupplied() {
        if (typeof url === 'undefined' || url.length === 0) {
            throw new Error('URL must be provided');
        }
    }

    function _throwErrorIfElementNotFound(element, definition) {
        var expectedTag = definition.elementType.toUpperCase();
        if (!element || element.tagName !== expectedTag) {
            throw new Error(definition.validationText);
        }
    }

    function _prefillActivationCodeFromQueryString() {
        var activationCode = _getUrlParameter('activation-code');
        if (activationCode && _hasVoucherField()) {
            formElements.activationCodeInput.value = activationCode;
        }
    }

    function _getUrlParameter(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        var results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    };

    function _addTermsCheckboxEventListener() {
        var form = formElements;
        form.termsCheckbox.addEventListener('click', _enableSubmitButtonIfTermsAgreed);
    }

    function _enableSubmitButtonIfTermsAgreed() {
        var form = formElements;
        form.submitButton.disabled = !form.termsCheckbox.checked;
    }

    function _addSubmitEventListener() {
        var form = formElements;
        form.submitButton.addEventListener('click', function (e) {
            e.preventDefault();

            _clearErrorFields();
            _setFormSubmittingState();
            _makeRequest();
        });
    }

    function _makeRequest() {
        getGaLinkerParam();
        var requestbody = _constructRequestBody();

        window.fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestbody),
        }).then(function(response) {
            if (response.ok) {
                response.json().then(_handleSuccessfulSubmission);
                return;
            }
            response.json().then(_handleFailedSubmission).finally(_setFormIdleState);
        }).catch(_setFormIdleState);
    }

    function _handleSuccessfulSubmission(responseBody) {
        var url = redirectUrl || responseBody.url;
        if (gaLinkerParam) {
            url += (url.includes('?') ? '&' : '?') + gaLinkerParam;
        }
        window.location.href = url;
    }

    function _handleFailedSubmission(responseBody) {
        if (!responseBody.error.hasOwnProperty('length')) {
            _showErrors(responseBody.error);
            return;
        } else {
            // the api is designed so that a single error always relates to the activation code hence this bit.
            var errors = {
                'activation_code': [
                    responseBody.error,
                ],
            };
            _showErrors(errors);
        }
    }

    function _showErrors(errors) {
        Object.keys(errors).forEach(function (field) {
            var container = formElements[field + 'ErrorContainer'];
            if(container) {
                container.innerHTML = '';
                for (var type in errors[field]) {
                    if (!errors[field].hasOwnProperty(type)) continue;
                    _renderError(errors[field][type], container);
                }
            }
        });
    }

    function _renderError(errorText, container) {
        var error = document.createElement('p');
        error.textContent = errorText;
        container.appendChild(error);
    }

    function _setFormSubmittingState() {
        formElements.submitButton.disabled = true;
        formElements.submitButton.innerText = submitButtonPendingText;
    }

    function _setFormIdleState() {
        formElements.submitButton.disabled = false;
        formElements.submitButton.innerText = originalSubmitText;
    }

    function _clearErrorFields() {
        formElements.passwordErrorContainer.innerText = '';
        formElements.emailErrorContainer.innerText = '';
        if (_hasVoucherField()) {
            formElements['activation_codeErrorContainer'].innerText = '';
        }
    }

    function _constructRequestBody() {
        var distinctId = getDistinctId();
        var requestBody = {
            email: formElements.emailField.value,
            password: formElements.passwordField.value,
            terms: formElements.termsCheckbox.checked || false,
            newsletter: formElements.newsletterCheckbox.checked || false,
        };
        if (_hasVoucherField()) {
            requestBody['activation_code'] = formElements.activationCodeInput.value;
        }
        if (overrideStartingPackageRef !== null) {
            requestBody['packageRef'] = overrideStartingPackageRef;
        }
        if (distinctId) {
            requestBody['distinct_id'] = distinctId;
        }
        var utmSource = getUtmSource();
        if (utmSource) {
            requestBody['utm_source'] = utmSource;
        }
        return requestBody;
    }

    function getDistinctId() {
        var distinctId = null;
        try {
            if (window.mixpanel) {
                distinctId = mixpanel.get_distinct_id();
            }
        } catch (err) {

        }

        return distinctId;
    }

    function getUtmSource() {
        return _getUrlParameter('utm_source');
    }
  
    function getGaLinkerParam() {
        try {
            if (typeof window.ga != 'undefined') {
                gaLinkerParam = ga.getAll()[0].get('linkerParam');
            }
        } catch (err) {

        }
    }

    return {
        initialiseForm: initialiseForm,
    };
}());
