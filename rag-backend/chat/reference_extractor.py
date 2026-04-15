"""
Reference Extractor for aeronautical documents.
Detects cross-references and retrieves related sections.
"""

import re
from typing import List, Set, Optional
from dataclasses import dataclass


@dataclass
class Reference:
    """A detected reference to another section."""
    section_id: str
    original_text: str
    doc_code: Optional[str] = None
    normalized_id: Optional[str] = None  # The ID as stored in DB


class ReferenceExtractor:
    """
    Extracts cross-references from document text.
    Handles various reference formats in aeronautical standards.
    """
    
    # Patterns for detecting references
    PATTERNS = [
        # CS 23.2270 or CS-23.2270 or CS23.2270
        r'CS[\s-]*23\.(\d{3,4})',
        
        # Bare "23.2270" (without CS prefix) — common in user queries
        r'(?:^|\s)(23\.\d{3,4})(?:\s|$|\?|\.|,|\()',
        
        # "Section 5.6.4.1(2)" or "section 5.6.4.1"
        r'[Ss]ection\s+(\d+(?:\.\d+)*(?:\s*\(\d+\))?)',
        
        # "§5.6.4.1" or "§ 5.6.4.1(2)"
        r'§\s*(\d+(?:\.\d+)*(?:\s*\(\d+\))?)',
        
        # "5.6.4.1(2)" when preceded by "see", "per", "in", "of", "to"
        r'(?:see|per|in|of|to|under|comply with|accordance with|specified in|requirements of)\s+(\d+\.\d+(?:\.\d+)*(?:\s*\(\d+\))?)',
        
        # "paragraph 5.6.4.1"
        r'[Pp]aragraph\s+(\d+(?:\.\d+)*(?:\s*\(\d+\))?)',
        
        # References like "4.1.2.2" in parentheses
        r'\((\d+\.\d+\.\d+(?:\.\d+)?)\)',
        
        # "Appendix X1" or "Annex A"
        r'([Aa]ppendix\s+[A-Z]\d*)',
        r'([Aa]nnex\s+[A-Z]\d*)',
        
        # External document references "ASTM F3083" or "CS 23.XXX"
        r'(ASTM\s+F\d+(?:/F\d+M)?(?:-\d+\w*)?)',
        r'(AC\s+\d+-\d+\w*)',
        r'(FAR\s+\d+\.\d+)',
        r'(Part\s+\d+\.\d+)',
        
        # AMC references like "AMC1 to CS 23.2260"
        r'AMC\d*\s+to\s+CS[\s-]*23\.(\d{3,4})',
        
        # GM references like "GM1 to CS 23.2260"
        r'GM\d*\s+to\s+CS[\s-]*23\.(\d{3,4})',
    ]
    
    def __init__(self):
        # Compile patterns for efficiency
        self.compiled_patterns = [re.compile(p, re.IGNORECASE) for p in self.PATTERNS]
    
    def extract_references(self, text: str) -> List[Reference]:
        """
        Extract all references from text.
        
        Args:
            text: Document text to analyze
            
        Returns:
            List of Reference objects
        """
        references = []
        seen: Set[str] = set()
        
        for pattern in self.compiled_patterns:
            for match in pattern.finditer(text):
                ref_text = match.group(1) if match.groups() else match.group(0)
                
                # Normalize the reference
                normalized = self._normalize_reference(ref_text)
                
                if normalized and normalized not in seen:
                    seen.add(normalized)
                    references.append(Reference(
                        section_id=normalized,
                        original_text=match.group(0),
                        normalized_id=self._to_db_format(normalized)
                    ))
        
        return references
    
    def extract_section_references(self, text: str) -> List[str]:
        """
        Extract only section number references and return DB-ready IDs.
        
        Args:
            text: Document text
            
        Returns:
            List of section IDs in DB format
        """
        references = self.extract_references(text)
        
        # Filter and normalize to DB format
        section_refs = []
        for ref in references:
            db_id = ref.normalized_id or self._to_db_format(ref.section_id)
            if db_id:
                section_refs.append(db_id)
        
        return list(set(section_refs))
    
    def _normalize_reference(self, ref: str) -> str:
        """Normalize a reference string."""
        # Remove extra whitespace
        ref = ' '.join(ref.split())
        
        # Remove trailing punctuation
        ref = ref.rstrip('.,;:')
        
        return ref
    
    def _to_db_format(self, ref: str) -> Optional[str]:
        """
        Convert a reference to the format stored in DB.
        DB uses 'cs_23_XXXX' format for CS-23 sections.
        
        Examples:
            "CS 23.2270" -> "cs_23_2270"
            "23.2270" -> "cs_23_2270"
            "2270" -> "cs_23_2270"
            "5.6.4.1" -> "5.6.4.1"
        """
        # Handle CS-23 format: extract and convert to cs_23_XXX/XXXX
        cs_match = re.search(r'(?:CS[\s-]*)?(23\.(\d{3,4}))', ref)
        if cs_match:
            digits = cs_match.group(2)  # "301" or "2270"
            return f"cs_23_{digits}"    # "cs_23_301"
        
        # Handle 4-digit standalone (like "2270") — assumed CS-23
        if re.match(r'^\d{4}$', ref):
            return f"cs_23_{ref}"
        
        # Handle dotted format (like "5.6.4.1")
        if re.match(r'^\d+(?:\.\d+)+', ref):
            # Remove parenthetical parts
            clean_id = re.sub(r'\s*\(\d+\)', '', ref)
            return clean_id
        
        return None
    
    def normalize_user_query(self, query: str) -> List[str]:
        """
        Extract section IDs from user query in DB format.
        
        Examples:
            "CS 23.2270" -> ["cs_23_2270"]
            "the 23.2270" -> ["cs_23_2270"]
            "section 5.6.4.1" -> ["5.6.4.1"]
        """
        refs = self.extract_references(query)
        seen = set()
        result = []
        for r in refs:
            if r.normalized_id and r.normalized_id not in seen:
                seen.add(r.normalized_id)
                result.append(r.normalized_id)
        return result
    
    def find_references_in_context(self, chunks: list) -> List[str]:
        """
        Find all section references mentioned in a list of chunks.
        
        Args:
            chunks: List of chunk objects with 'content' attribute
            
        Returns:
            List of unique section IDs in DB format
        """
        all_refs: Set[str] = set()
        
        for chunk in chunks:
            content = chunk.content if hasattr(chunk, 'content') else chunk.get('content', '')
            refs = self.extract_section_references(content)
            all_refs.update(refs)
        
        return list(all_refs)
    
    def get_missing_references(self, referenced_sections: List[str], 
                                available_sections: List[str]) -> List[str]:
        """
        Find which referenced sections are not in the current context.
        
        Args:
            referenced_sections: Sections mentioned in text
            available_sections: Sections already in context
            
        Returns:
            List of section IDs that need to be fetched
        """
        available_set = set(available_sections)
        missing = []
        
        for ref in referenced_sections:
            # Check if this section or a parent is available
            found = False
            for avail in available_set:
                if ref.startswith(avail) or avail.startswith(ref) or ref == avail:
                    found = True
                    break
            
            if not found:
                missing.append(ref)
        
        return missing
