from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.views import exception_handler


def accounts_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        exc = _django_validation_to_drf_validation(exc)

    response = exception_handler(exc, context)
    if response is None:
        return response

    response.data = {
        "error": {
            "code": _error_code(exc, response.status_code),
            "message": _error_message(response.data),
            "fields": _field_errors(response.data),
        }
    }
    return response


def _django_validation_to_drf_validation(exc):
    from rest_framework.exceptions import ValidationError

    if hasattr(exc, "message_dict"):
        return ValidationError(exc.message_dict)
    return ValidationError(exc.messages)


def _error_code(exc, status_code):
    default_code = getattr(exc, "default_code", None)
    if default_code:
        return str(default_code)
    if status_code == 429:
        return "throttled"
    if status_code == 401:
        return "not_authenticated"
    if status_code == 403:
        return "permission_denied"
    if status_code == 404:
        return "not_found"
    if status_code >= 500:
        return "server_error"
    return "validation_error"


def _error_message(data):
    if isinstance(data, dict):
        detail = data.get("detail")
        if detail is not None:
            return str(detail)
        non_field_errors = data.get("non_field_errors")
        if isinstance(non_field_errors, list) and non_field_errors:
            return str(non_field_errors[0])
        return "Please check the submitted values."

    if isinstance(data, list) and data:
        return str(data[0])

    return "Something went wrong."


def _field_errors(data):
    if not isinstance(data, dict):
        return {}

    fields = {}
    for key, value in data.items():
        if key in {"detail", "non_field_errors"}:
            continue
        if isinstance(value, list):
            fields[key] = [str(item) for item in value]
        else:
            fields[key] = [str(value)]
    return fields
