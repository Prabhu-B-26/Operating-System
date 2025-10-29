from django.db import models
from django.contrib.auth.models import User

class FileSystemObject(models.Model):
    # The name of the file or folder
    name = models.CharField(max_length=255)

    # A boolean to check if it's a folder (True) or a file (False)
    is_directory = models.BooleanField(default=False)

    # Link to the user who owns this object. If the user is deleted, all their files are too.
    owner = models.ForeignKey(User, on_delete=models.CASCADE)

    # Link to the parent folder. Allows for nesting. Can be null for the root directory.
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True)

    # Storing permissions as a simple text string, e.g., "rwx-r--"
    permissions = models.CharField(max_length=10, default='rwx------')

    # Timestamps that are automatically set
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    content = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class Process(models.Model):
    STATUS_CHOICES = [
        ('Ready', 'Ready'),
        ('Running', 'Running'),
        ('Blocked', 'Blocked'),
        ('Finished', 'Finished'),
    ]

    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    file_object = models.ForeignKey(FileSystemObject, on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Ready')
    page_table = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"PID {self.id} ({self.file_object.name}) - {self.status}"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    storage_limit = models.PositiveIntegerField(default=10000)  # bytes
    storage_used = models.PositiveIntegerField(default=0)       # bytes

    def __str__(self):
        return f"Profile({self.user.username}): {self.storage_used}/{self.storage_limit}"