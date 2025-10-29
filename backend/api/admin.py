from django.contrib import admin
from .models import FileSystemObject
from .models import FileSystemObject, Process
@admin.register(FileSystemObject)
class FileSystemObjectAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the FileSystemObject model.
    """
    # Columns to display in the list view
    list_display = ('name', 'owner', 'is_directory', 'parent', 'created_at', 'permissions')

    # Fields to allow filtering by
    list_filter = ('is_directory', 'owner')

    # Fields to enable searching on
    search_fields = ('name', 'owner__username')

    # Make permissions editable in the list view
    list_editable = ('permissions',)

    # Order the list by parent and then by name
    ordering = ('parent__name', 'name')

@admin.register(Process)
class ProcessAdmin(admin.ModelAdmin):
    # Add 'page_table' to this list
    list_display = ('id', 'owner', 'file_object', 'status', 'page_table', 'created_at')
    list_filter = ('status', 'owner')
    search_fields = ('owner__username', 'file_object__name')
    ordering = ('-created_at',)