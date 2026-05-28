from django.conf import settings


def set_auth_cookies(response, access_token, refresh_token):
    secure = getattr(settings, "COOKIE_SECURE", False)
    same_site = settings.SIMPLE_JWT.get("AUTH_COOKIE_SAMESITE", "Lax")
    cookie_path = settings.SIMPLE_JWT.get("AUTH_COOKIE_PATH", "/")
    access_lifetime = settings.SIMPLE_JWT.get("ACCESS_TOKEN_LIFETIME")
    refresh_lifetime = settings.SIMPLE_JWT.get("REFRESH_TOKEN_LIFETIME")

    response.set_cookie(
        key=settings.SIMPLE_JWT.get("AUTH_COOKIE", "access"),
        value=str(access_token),
        httponly=True,
        secure=secure,
        samesite=same_site,
        path=cookie_path,
        max_age=int(access_lifetime.total_seconds()) if access_lifetime else None,
    )
    response.set_cookie(
        key=settings.SIMPLE_JWT.get("AUTH_COOKIE_REFRESH", "refresh"),
        value=str(refresh_token),
        httponly=True,
        secure=secure,
        samesite=same_site,
        path=cookie_path,
        max_age=int(refresh_lifetime.total_seconds()) if refresh_lifetime else None,
    )
    return response


def clear_auth_cookies(response):
    cookie_path = settings.SIMPLE_JWT.get("AUTH_COOKIE_PATH", "/")
    response.delete_cookie(settings.SIMPLE_JWT.get("AUTH_COOKIE", "access"), path=cookie_path)
    response.delete_cookie(
        settings.SIMPLE_JWT.get("AUTH_COOKIE_REFRESH", "refresh"),
        path=cookie_path,
    )
    return response
