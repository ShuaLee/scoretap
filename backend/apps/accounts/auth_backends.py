from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model


class ActiveAccountBackend(ModelBackend):
    def get_user(self, user_id):
        UserModel = get_user_model()
        try:
            user = UserModel._default_manager.get(pk=user_id, deleted_at__isnull=True)
        except UserModel.DoesNotExist:
            return None
        return user if self.user_can_authenticate(user) else None
