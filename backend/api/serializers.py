from rest_framework import serializers
from django.contrib.auth.models import User
from .models import FileSystemObject
from .models import Process

class FileSystemObjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = FileSystemObject
        # The owner is now a read-only field
        fields = ['id', 'name', 'is_directory', 'owner', 'parent', 'permissions', 'created_at','content']
        read_only_fields = ['owner'] # This tells the serializer not to expect the owner on create/update

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'password']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password']
        )
        return user

class ProcessSerializer(serializers.ModelSerializer):
    file_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Process
        fields = ['id', 'owner', 'file_object', 'file_name', 'status', 'page_table', 'created_at']
        read_only_fields = ['owner', 'status', 'file_name', 'page_table']

    def get_file_name(self, obj):
        return obj.file_object.name if obj.file_object else None