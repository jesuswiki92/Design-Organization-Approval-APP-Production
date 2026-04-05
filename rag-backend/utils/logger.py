"""
Sistema de logging para la aplicación.
"""

import logging
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional
from config import settings


class AppLogger:
    """
    Logger centralizado para la aplicación.
    Escribe logs a consola y opcionalmente a archivo.
    """
    
    def __init__(self, name: str = "RAG_Aeronautica", log_to_file: bool = False):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)
        
        # Evitar duplicados
        if self.logger.handlers:
            return
        
        # Formato de logs
        formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        # Handler de consola
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)
        
        # Handler de archivo (opcional)
        if log_to_file:
            log_dir = settings.BASE_DIR / "logs"
            log_dir.mkdir(exist_ok=True)
            
            log_file = log_dir / f"app_{datetime.now().strftime('%Y%m%d')}.log"
            file_handler = logging.FileHandler(log_file, encoding='utf-8')
            file_handler.setLevel(logging.DEBUG)
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)
    
    def info(self, message: str) -> None:
        """Log de información."""
        self.logger.info(message)
    
    def debug(self, message: str) -> None:
        """Log de debug."""
        self.logger.debug(message)
    
    def warning(self, message: str) -> None:
        """Log de advertencia."""
        self.logger.warning(message)
    
    def error(self, message: str, exc_info: bool = False) -> None:
        """Log de error."""
        self.logger.error(message, exc_info=exc_info)
    
    def success(self, message: str) -> None:
        """Log de éxito (usa INFO con prefijo)."""
        self.logger.info(f"[OK] {message}")

    def step(self, message: str) -> None:
        """Log de paso de proceso."""
        self.logger.info(f"[->] {message}")


# Instancia global
logger = AppLogger(log_to_file=settings.LOG_TO_FILE)
