from django.urls import path,include
from rest_framework.routers import DefaultRouter
from .views import (
    CreateUserView,
    FileSystemObjectList,
    FileSystemObjectDetail,
    FileContentView,
    ProcessViewSet,
    MemorySnapshotView,
    QuotaView
)

router = DefaultRouter()
router.register(r'processes', ProcessViewSet, basename='process')
urlpatterns = [
    # User authentication
    path('register/', CreateUserView.as_view()),

    # List and Create files/folders
    path('objects/', FileSystemObjectList.as_view()),

    # Retrieve, Update, Delete a specific file/folder
    path('objects/<int:pk>/', FileSystemObjectDetail.as_view()),

    # Read and Write content for a specific file
    path('objects/<int:pk>/content/', FileContentView.as_view()),
    path('memory-snapshot/', MemorySnapshotView.as_view()),
    path('quota/', QuotaView.as_view()),
    path('', include(router.urls)),
]