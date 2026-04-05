"""
Clasificador de documentos aeronáuticos.
Identifica el tipo de documento, agencia emisora y código estándar.
"""

import re
from dataclasses import dataclass
from typing import Optional
from pathlib import Path


@dataclass
class DocumentClassification:
    """Resultado de la clasificación de un documento."""
    filename: str
    doc_type: str
    agency: str
    standard_code: str
    confidence: str  # "high", "medium", "low"
    details: dict


class AeronauticalClassifier:
    """
    Clasifica documentos aeronáuticos basándose en el nombre del archivo
    y patrones conocidos de códigos de estándares.
    """
    
    # Patrones de identificación
    PATTERNS = {
        "EASA_CS": {
            "regex": r"(CS[-\s]?23|CS[-\s]?25|CS[-\s]?27|CS[-\s]?29|CS[-\s]?E|CS[-\s]?P|CS[-\s]?APU)",
            "agency": "EASA",
            "doc_type": "Certification Specification",
        },
        "FAA_AC": {
            "regex": r"(AC[-\s_]?\d{2,3}[-\s]?\d*[A-Z]*)",
            "agency": "FAA",
            "doc_type": "Advisory Circular",
        },
        "FAA_PART": {
            "regex": r"(14\s*CFR\s*Part\s*\d+|FAR[-\s]?Part[-\s]?\d+|Part[-\s]?\d+)",
            "agency": "FAA",
            "doc_type": "Federal Aviation Regulation",
        },
        "ASTM": {
            "regex": r"(ASTM[-\s]?F\d{3,4}|F\d{4}_F\d{4}M?[-]\d{2}[a-z]?|F\d{3,4}[-/]?F?\d*M?[-]?\d{2}[a-z]?)",
            "agency": "ASTM",
            "doc_type": "Standard",
        },
        "SAE": {
            "regex": r"(SAE[-\s]?(AS|ARP|AIR|AMS)[-\s]?\d+)",
            "agency": "SAE International",
            "doc_type": "Aerospace Standard",
        },
        "RTCA": {
            "regex": r"(RTCA[-\s]?DO[-\s]?\d+[A-Z]?|DO[-\s]?\d+[A-Z]?)",
            "agency": "RTCA",
            "doc_type": "Design Guideline",
        },
        "MIL": {
            "regex": r"(MIL[-\s]?(STD|SPEC|HDBK)[-\s]?\d+[A-Z]?)",
            "agency": "US Military",
            "doc_type": "Military Standard",
        },
        "ICAO": {
            "regex": r"(ICAO[-\s]?Annex[-\s]?\d+|Annex[-\s]?\d+)",
            "agency": "ICAO",
            "doc_type": "International Standard",
        },
    }
    
    # Palabras clave adicionales para mejorar la clasificación
    KEYWORDS = {
        "certification": ["certification", "certificación", "type certificate", "TC"],
        "airworthiness": ["airworthiness", "aeronavegabilidad", "AWD", "AD"],
        "maintenance": ["maintenance", "mantenimiento", "IPC", "AMM", "CMM"],
        "operations": ["operations", "operaciones", "flight manual", "AFM", "POH"],
        "design": ["design", "diseño", "specification", "especificación"],
    }
    
    def classify(self, filename: str, content_preview: Optional[str] = None) -> DocumentClassification:
        """
        Clasifica un documento basándose en su nombre de archivo.
        
        Args:
            filename: Nombre del archivo (con o sin ruta)
            content_preview: Opcional, texto inicial del documento para mejorar clasificación
            
        Returns:
            DocumentClassification con los resultados
        """
        # Extraer solo el nombre del archivo si viene con ruta
        clean_filename = Path(filename).stem
        
        # Buscar coincidencias con patrones conocidos
        classification = self._match_patterns(clean_filename)
        
        # Si no hay coincidencia clara, intentar con el contenido
        if classification.confidence == "low" and content_preview:
            classification = self._enhance_with_content(classification, content_preview)
        
        return classification
    
    def _match_patterns(self, filename: str) -> DocumentClassification:
        """Busca coincidencias con patrones conocidos."""
        filename_upper = filename.upper()
        
        for pattern_name, pattern_info in self.PATTERNS.items():
            match = re.search(pattern_info["regex"], filename_upper, re.IGNORECASE)
            
            if match:
                standard_code = self._clean_code(match.group(1))
                
                return DocumentClassification(
                    filename=filename,
                    doc_type=pattern_info["doc_type"],
                    agency=pattern_info["agency"],
                    standard_code=standard_code,
                    confidence="high",
                    details={
                        "pattern_matched": pattern_name,
                        "raw_match": match.group(1),
                    }
                )
        
        # Sin coincidencia - clasificación genérica
        return DocumentClassification(
            filename=filename,
            doc_type="General Technical Document",
            agency="Unknown",
            standard_code=self._extract_possible_code(filename),
            confidence="low",
            details={
                "pattern_matched": None,
                "note": "No se encontró patrón conocido"
            }
        )
    
    def _clean_code(self, raw_code: str) -> str:
        """Limpia y normaliza el código del estándar."""
        code = raw_code.strip()
        # Normalise ASTM dual-form: F3083_F3083M-23a → F3083M-23a
        astm_dual = re.match(r'F(\d{4})_F\d{4}(M?[-]\d{2}[a-z]?)', code, re.IGNORECASE)
        if astm_dual:
            return f"F{astm_dual.group(1)}{astm_dual.group(2)}".upper()
        # Reemplazar separadores inconsistentes
        code = re.sub(r'[-_\s]+', '-', code)
        return code.upper()
    
    def _extract_possible_code(self, filename: str) -> str:
        """Intenta extraer un código posible del nombre del archivo."""
        fn = filename.upper()
        # Try ASTM dual-form first: F3083_F3083M-23a → F3083M-23a
        astm_dual = re.search(r'F(\d{4})_F\d{4}(M?[-]\d{2}[a-zA-Z]?)', fn)
        if astm_dual:
            return f"F{astm_dual.group(1)}{astm_dual.group(2)}"
        # Try ASTM single-form: F3083M-23a
        astm_single = re.search(r'(F\d{3,4}M?[-]\d{2}[a-zA-Z]?)', fn)
        if astm_single:
            return astm_single.group(1)
        # Fallback: generic alphanumeric code
        matches = re.findall(r'([A-Z]{1,4}[-_]?\d{2,5}[A-Z]?)', fn)
        if matches:
            return matches[0]
        return "N/A"
    
    def _enhance_with_content(self, classification: DocumentClassification, 
                              content: str) -> DocumentClassification:
        """Mejora la clasificación usando el contenido del documento."""
        content_upper = content.upper()
        
        # Buscar patrones en el contenido
        for pattern_name, pattern_info in self.PATTERNS.items():
            match = re.search(pattern_info["regex"], content_upper)
            
            if match:
                return DocumentClassification(
                    filename=classification.filename,
                    doc_type=pattern_info["doc_type"],
                    agency=pattern_info["agency"],
                    standard_code=self._clean_code(match.group(1)),
                    confidence="medium",
                    details={
                        "pattern_matched": pattern_name,
                        "source": "content_analysis",
                        "raw_match": match.group(1),
                    }
                )
        
        return classification
    
    def get_classification_summary(self, classification: DocumentClassification) -> str:
        """Genera un resumen legible de la clasificación."""
        confidence_label = {
            "high": "[HIGH]",
            "medium": "[MED]",
            "low": "[LOW]"
        }

        level = confidence_label.get(classification.confidence, "[?]")

        return f"""
[TAG] **Clasificacion del Documento**
-------------------------------
[FILE] Archivo: {classification.filename}
[ORG] Agencia: {classification.agency}
[TYPE] Tipo: {classification.doc_type}
[CODE] Codigo: {classification.standard_code}
{level} Confianza: {classification.confidence.upper()}
"""


# Función de conveniencia para uso rápido
def classify_document(filename: str, content_preview: Optional[str] = None) -> DocumentClassification:
    """Función de conveniencia para clasificar un documento."""
    classifier = AeronauticalClassifier()
    return classifier.classify(filename, content_preview)