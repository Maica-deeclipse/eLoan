"""
File Encryption Service for Sensitive Documents

This service provides encryption and decryption utilities for storing
sensitive files at rest using Fernet symmetric encryption (AES-128).

Features:
1. File encryption before storage
2. File decryption for retrieval
3. Integrity verification (built into Fernet)
4. Key management support

Security:
- Uses cryptography.fernet.Fernet (AES-128 CBC + HMAC)
- Authenticated encryption prevents tampering
- Key stored securely in environment variables
"""

import os
import logging
from typing import Optional, Tuple
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

logger = logging.getLogger('encryption')


class FileEncryptionService:
    """
    Service for encrypting and decrypting files at rest.

    Uses Fernet symmetric encryption which provides:
    - AES-128 encryption in CBC mode
    - HMAC for authentication and integrity
    - Timestamp for token expiration (optional)
    """

    @staticmethod
    def get_cipher() -> Fernet:
        """
        Get Fernet cipher instance using encryption key from settings.

        Returns:
            Fernet: Cipher instance for encryption/decryption

        Raises:
            ValueError: If encryption key is invalid or not configured
        """
        try:
            encryption_key = settings.ENCRYPTION_KEY

            if not encryption_key:
                raise ValueError("ENCRYPTION_KEY not configured in settings")

            # Ensure key is bytes
            if isinstance(encryption_key, str):
                encryption_key = encryption_key.encode()

            return Fernet(encryption_key)

        except Exception as e:
            logger.error(f"Failed to initialize cipher: {str(e)}")
            raise ValueError(f"Invalid encryption key configuration: {str(e)}")

    @classmethod
    def encrypt_file(cls, file_path: str) -> Tuple[bool, Optional[str]]:
        """
        Encrypt a file in place.

        Reads the file, encrypts its contents, and overwrites it with
        the encrypted version.

        Args:
            file_path: Full path to the file to encrypt

        Returns:
            Tuple of (success: bool, error_message: Optional[str])

        Example:
            success, error = FileEncryptionService.encrypt_file('/path/to/file.pdf')
            if success:
                print("File encrypted successfully")
            else:
                print(f"Encryption failed: {error}")
        """
        try:
            # Validate file exists
            if not os.path.exists(file_path):
                return False, f"File not found: {file_path}"

            # Get cipher
            cipher = cls.get_cipher()

            # Read plaintext file
            with open(file_path, 'rb') as f:
                plaintext = f.read()

            # Encrypt data
            encrypted_data = cipher.encrypt(plaintext)

            # Write encrypted data back to file
            with open(file_path, 'wb') as f:
                f.write(encrypted_data)

            logger.info(f"Successfully encrypted file: {file_path}")
            return True, None

        except ValueError as e:
            error_msg = f"Encryption key error: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

        except PermissionError as e:
            error_msg = f"Permission denied accessing file: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

        except Exception as e:
            error_msg = f"Encryption failed: {str(e)}"
            logger.error(error_msg)
            import traceback
            logger.error(traceback.format_exc())
            return False, error_msg

    @classmethod
    def decrypt_file(cls, file_path: str) -> Tuple[bool, Optional[bytes], Optional[str]]:
        """
        Decrypt a file and return its contents.

        Does NOT modify the original encrypted file. Returns decrypted
        data in memory for serving to user or processing.

        Args:
            file_path: Full path to the encrypted file

        Returns:
            Tuple of (success: bool, decrypted_data: Optional[bytes], error_message: Optional[str])

        Example:
            success, data, error = FileEncryptionService.decrypt_file('/path/to/encrypted.pdf')
            if success:
                # Serve decrypted data to user
                return HttpResponse(data, content_type='application/pdf')
            else:
                return JsonResponse({'error': error}, status=500)
        """
        try:
            # Validate file exists
            if not os.path.exists(file_path):
                return False, None, f"File not found: {file_path}"

            # Get cipher
            cipher = cls.get_cipher()

            # Read encrypted file
            with open(file_path, 'rb') as f:
                encrypted_data = f.read()

            # Decrypt data
            decrypted_data = cipher.decrypt(encrypted_data)

            logger.info(f"Successfully decrypted file: {file_path}")
            return True, decrypted_data, None

        except InvalidToken:
            error_msg = "File is corrupted or was encrypted with a different key"
            logger.error(f"Decryption failed for {file_path}: {error_msg}")
            return False, None, error_msg

        except ValueError as e:
            error_msg = f"Encryption key error: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

        except PermissionError as e:
            error_msg = f"Permission denied accessing file: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

        except Exception as e:
            error_msg = f"Decryption failed: {str(e)}"
            logger.error(error_msg)
            import traceback
            logger.error(traceback.format_exc())
            return False, None, error_msg

    @classmethod
    def is_file_encrypted(cls, file_path: str) -> bool:
        """
        Check if a file appears to be encrypted.

        Attempts to decrypt the file. If successful, it was encrypted.

        Args:
            file_path: Path to file to check

        Returns:
            bool: True if file is encrypted, False otherwise
        """
        try:
            success, _, _ = cls.decrypt_file(file_path)
            return success
        except Exception:
            return False

    @staticmethod
    def generate_key() -> str:
        """
        Generate a new Fernet encryption key.

        Use this to generate a key for production deployment.

        Returns:
            str: Base64-encoded encryption key

        Example:
            key = FileEncryptionService.generate_key()
            print(f"Add this to your .env file:\nENCRYPTION_KEY={key}")
        """
        return Fernet.generate_key().decode()


class EncryptionKeyManager:
    """
    Utility for managing encryption keys and key rotation.

    Future enhancement: Support multiple key versions for key rotation
    without re-encrypting all existing files immediately.
    """

    @staticmethod
    def validate_key(key: str) -> bool:
        """
        Validate that a key is a valid Fernet key.

        Args:
            key: Encryption key to validate

        Returns:
            bool: True if valid, False otherwise
        """
        try:
            if isinstance(key, str):
                key = key.encode()
            Fernet(key)
            return True
        except Exception:
            return False

    @staticmethod
    def get_key_info() -> dict:
        """
        Get information about the current encryption key configuration.

        Returns:
            dict: Key configuration information
        """
        try:
            key = settings.ENCRYPTION_KEY
            is_valid = EncryptionKeyManager.validate_key(key)

            return {
                'configured': bool(key),
                'valid': is_valid,
                'source': 'environment' if key else 'not_set',
                'length': len(key) if key else 0
            }
        except Exception as e:
            return {
                'configured': False,
                'valid': False,
                'error': str(e)
            }
