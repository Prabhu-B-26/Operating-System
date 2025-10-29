from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import FileSystemObject
from .serializers import UserSerializer, FileSystemObjectSerializer
import time
from rest_framework.views import APIView
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from .models import Process # Add Process to imports
from .serializers import ProcessSerializer # Add ProcessSerializer to imports
from .apps import PHYSICAL_RAM_FRAMES, LAST_EVENT

# ... (Keep CreateUserView, FileSystemObjectList, FileSystemObjectDetail the same) ...
# This part is just for context, no changes needed here.
LOCK_MANAGER = {}

class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]

class FileSystemObjectList(generics.ListCreateAPIView):
    serializer_class = FileSystemObjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        parent_id = self.request.query_params.get('parent')
        if parent_id == 'null' or parent_id is None:
            return FileSystemObject.objects.filter(owner=user, parent__isnull=True).order_by('name')
        else:
            return FileSystemObject.objects.filter(owner=user, parent_id=parent_id).order_by('name')

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

class FileSystemObjectDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FileSystemObjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return FileSystemObject.objects.filter(owner=self.request.user)

# --- THIS IS THE PART TO FOCUS ON ---
class FileContentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        # ... (this method stays the same)
        try:
            file_object = FileSystemObject.objects.get(pk=pk, owner=request.user, is_directory=False)
            perms = (file_object.permissions or '')
            # Owner read check (simplified): expect 'r' at index 0 for owner read
            if len(perms) >= 1 and perms[0] != 'r':
                return Response({"error": "Permission denied: read not allowed"}, status=status.HTTP_403_FORBIDDEN)
            return Response({"content": file_object.content or ""})
        except FileSystemObject.DoesNotExist:
            return Response({"error": "File not found or it is a directory."}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk):
        try:
            file_object = FileSystemObject.objects.get(pk=pk, owner=request.user, is_directory=False)
            # Write permission check: expect 'w' at index 1
            perms = (file_object.permissions or '')
            if len(perms) >= 2 and perms[1] != 'w':
                return Response({"error": "Permission denied: write not allowed"}, status=status.HTTP_403_FORBIDDEN)

            # File locking: prevent concurrent writes
            fid = int(pk)
            if LOCK_MANAGER.get(fid):
                return Response({"error": "File is locked for writing"}, status=status.HTTP_423_LOCKED)
            LOCK_MANAGER[fid] = True
            new_content = request.data.get("content", "")

            try:
                # Simulate write processing time so concurrent requests see the lock
                time.sleep(5)
                old_content = file_object.content or ""
                # compute the would-be content based on append vs overwrite
                if request.data.get("append", False):
                    new_full = (old_content + ("\n" if old_content and new_content else "") + new_content)
                else:
                    new_full = new_content

                # Disk quota enforcement
                # storage_used tracks total user bytes across files; adjust by delta of this file
                from .models import UserProfile
                profile, _ = UserProfile.objects.get_or_create(user=request.user)
                old_len = len(old_content.encode('utf-8'))
                new_len = len(new_full.encode('utf-8'))
                delta = new_len - old_len
                if delta > 0 and (profile.storage_used + delta) > profile.storage_limit:
                    return Response({"error": "Disk quota exceeded"}, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

                # Apply write
                file_object.content = new_full
                file_object.save()

                # Update quota usage
                profile.storage_used = max(0, profile.storage_used + delta)
                profile.save(update_fields=['storage_used'])

                return Response({"content": file_object.content})
            finally:
                LOCK_MANAGER.pop(fid, None)
        except FileSystemObject.DoesNotExist:
            return Response({"error": "File not found or it is a directory."}, status=status.HTTP_404_NOT_FOUND)

class ProcessViewSet(viewsets.ModelViewSet):
    serializer_class = ProcessSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Users can only see their own processes
        return Process.objects.filter(owner=self.request.user)

    def create(self, request, *args, **kwargs):
        # Validate exec permission before creating
        file_id = request.data.get('file_object')
        try:
            f = FileSystemObject.objects.get(id=file_id, owner=request.user, is_directory=False)
        except FileSystemObject.DoesNotExist:
            return Response({"error": "Invalid program file"}, status=status.HTTP_400_BAD_REQUEST)
        perms = (f.permissions or '')
        if len(perms) >= 3 and perms[2] != 'x':
            raise PermissionDenied('Permission denied: execute not allowed')
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        # Automatically set the owner to the current user
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=['post'])
    def pkill(self, request):
        """
        Delete all Ready/Running processes owned by the user whose file name matches the provided name.
        Request body: { "name": "<file_name>" }
        """
        name = request.data.get('name')
        if not name:
            return Response({"error": "name is required"}, status=status.HTTP_400_BAD_REQUEST)

        qs = Process.objects.filter(
            owner=request.user,
            status__in=['Ready', 'Running'],
            file_object__name=name,
        )
        count = qs.count()
        qs.delete()
        return Response({"killed": count})


class MemorySnapshotView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        running = Process.objects.filter(owner=request.user, status='Running').first()
        running_info = None
        if running:
            running_info = {
                'pid': running.id,
                'page_table': running.page_table or {},
            }
        frames = PHYSICAL_RAM_FRAMES
        return Response({
            'frames': frames,
            'running': running_info,
            'last_event': LAST_EVENT,
        })


class QuotaView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        return Response({
            'storage_used': profile.storage_used,
            'storage_limit': profile.storage_limit,
        })
