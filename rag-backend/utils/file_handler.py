"""
Manejador de archivos.
Utilidades para trabajar con archivos PDF y temporales.
"""

import shutil
from pathlib import Path
from typing import Optional, List
from config import settings


class FileHandler:
    """
    Gestiona operaciones de archivos para la aplicación.
    """
    
    def __init__(self):
        self.temp_dir = settings.TEMP_DIR
        self._ensure_temp_dir()
    
    def _ensure_temp_dir(self) -> None:
        """Asegura que el directorio temporal existe."""
        self.temp_dir.mkdir(parents=True, exist_ok=True)
    
    def copy_to_temp(self, file_path: str) -> str:
        """
        Copia un archivo al directorio temporal.
        
        Args:
            file_path: Ruta del archivo original
            
        Returns:
            Ruta del archivo en el directorio temporal
        """
        source = Path(file_path)
        
        if not source.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {file_path}")
        
        dest = self.temp_dir / source.name
        shutil.copy2(source, dest)
        
        return str(dest)
    
    def get_temp_path(self, filename: str) -> str:
        """
        Genera una ruta en el directorio temporal.
        
        Args:
            filename: Nombre del archivo
            
        Returns:
            Ruta completa en el directorio temporal
        """
        return str(self.temp_dir / filename)
    
    def clean_temp(self) -> int:
        """
        Limpia el directorio temporal.
        
        Returns:
            Número de archivos eliminados
        """
        count = 0
        
        for item in self.temp_dir.iterdir():
            try:
                if item.is_file():
                    item.unlink()
                    count += 1
                elif item.is_dir():
                    shutil.rmtree(item)
                    count += 1
            except Exception as e:
                print(f"Error eliminando {item}: {e}")
        
        return count
    
    def list_temp_files(self) -> List[str]:
        """Lista archivos en el directorio temporal."""
        return [str(f) for f in self.temp_dir.iterdir() if f.is_file()]
    
    def get_file_info(self, file_path: str) -> dict:
        """
        Obtiene información de un archivo.
        
        Args:
            file_path: Ruta del archivo
            
        Returns:
            Dict con información del archivo
        """
        path = Path(file_path)
        
        if not path.exists():
            return {"exists": False}
        
        stat = path.stat()
        
        return {
            "exists": True,
            "name": path.name,
            "stem": path.stem,
            "suffix": path.suffix.lower(),
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "is_pdf": path.suffix.lower() == ".pdf",
            "path": str(path.absolute())
        }
    
    def validate_pdf(self, file_path: str) -> tuple:
        """
        Valida que un archivo sea un PDF válido.
        
        Args:
            file_path: Ruta del archivo
            
        Returns:
            Tuple (es_valido, mensaje)
        """
        info = self.get_file_info(file_path)
        
        if not info["exists"]:
            return False, "El archivo no existe"
        
        if not info["is_pdf"]:
            return False, f"El archivo no es un PDF (extensión: {info['suffix']})"
        
        # Verificar que el archivo no esté vacío
        if info["size_bytes"] == 0:
            return False, "El archivo está vacío"
        
        # Verificar header de PDF
        try:
            with open(file_path, "rb") as f:
                header = f.read(5)
                if header != b"%PDF-":
                    return False, "El archivo no tiene un header PDF válido"
        except Exception as e:
            return False, f"Error leyendo el archivo: {e}"
        
        return True, "PDF válido"


# Instancia global para uso conveniente
file_handler = FileHandler()