#!/usr/bin/env python3
"""Safe residual Spanish-to-English sweep for UI text and comments.

Only applies whole-word replacements; never replaces inside identifiers or words.
It intentionally skips historical Supabase migrations.
"""
from __future__ import annotations
import argparse, json, re
from pathlib import Path

TEXT_SUFFIXES={'.ts','.tsx','.js','.jsx','.md','.mdx','.json','.html','.txt'}
SCAN_DIRS=['app','components','lib','types','docs','Formularios','01. Soporte_App','openspec']
SKIP_DIRS={'.git','.next','node_modules','rag-backend'}
SKIP_PREFIXES=('supabase/migrations/',)
WORD_CHARS='A-Za-zÀ-ÿ0-9_'
REPLACEMENTS={
 'Proyectos':'Projects','proyectos':'projects','Proyecto':'Project','proyecto':'project',
 'Formulario':'Form','formulario':'form','Formularios':'Forms','formularios':'forms',
 'Correo':'Email','correo':'email','Correos':'Emails','correos':'emails',
 'Enviar':'Send','enviar':'send','Enviado':'Sent','enviado':'sent','enviada':'sent','envio':'send','envío':'send',
 'Respuesta':'Response','respuesta':'response','respuestas':'responses',
 'Cliente':'Client','cliente':'client','Clientes':'Clients','clientes':'clients',
 'Fecha':'Date','fecha':'date','Fechas':'Dates','fechas':'dates',
 'Estado':'Status','estado':'status','Estados':'Statuses','estados':'statuses',
 'Descripcion':'Description','descripcion':'description','Descripción':'Description','descripción':'description',
 'Nombre':'Name','nombre':'name','Asunto':'Subject','asunto':'subject','Remitente':'Sender','remitente':'sender',
 'Clasificacion':'Classification','clasificacion':'classification','Clasificación':'Classification','clasificación':'classification',
 'Entrega':'Delivery','entrega':'delivery','entregas':'deliveries','Validacion':'Validation','validacion':'validation','Validación':'Validation','validación':'validation',
 'Aprobacion':'Approval','aprobacion':'approval','Aprobación':'Approval','aprobación':'approval',
 'Documento':'Document','documento':'document','Documentos':'Documents','documentos':'documents',
 'Historico':'Historical','historico':'historical','Histórico':'Historical','histórico':'historical',
 'Aeronave':'Aircraft','aeronave':'aircraft','Aeronaves':'Aircraft','aeronaves':'aircraft',
 'Modelo':'Model','modelo':'model','Fabricante':'Manufacturer','fabricante':'manufacturer',
 'Principal':'Primary','principal':'primary','Activo':'Active','activo':'active',
 'Cerrar':'Close','cerrar':'close','Archivar':'Archive','archivar':'archive',
 'Notas':'Notes','notas':'notes','Direccion':'Address','direccion':'address','Dirección':'Address','dirección':'address',
 'Telefono':'Phone','telefono':'phone','Teléfono':'Phone','teléfono':'phone',
 'Pais':'Country','pais':'country','País':'Country','país':'country','Ciudad':'City','ciudad':'city',
 'Carpeta':'Folder','carpeta':'folder','Ruta':'Path','ruta':'path',
 'Pagina':'Page','pagina':'page','Página':'Page','página':'page','Busqueda':'Search','busqueda':'search','Búsqueda':'Search','búsqueda':'search',
 'Usuario':'User','usuario':'user','usuarios':'users','Tabla':'Table','tabla':'table','Datos':'Data','datos':'data',
 'Pendiente':'Pending','pendiente':'pending','Revision':'Review','revision':'review','Revisión':'Review','revisión':'review',
 'Nuevo':'New','nuevo':'new','Nueva':'New','nueva':'new','Abierto':'Open','abierto':'open','Aceptada':'Accepted','aceptada':'accepted',
 'Rechazada':'Rejected','rechazada':'rejected','Preparar':'Prepare','preparar':'prepare',
 'Esperando':'Awaiting','esperando':'awaiting','Recibido':'Received','recibido':'received','recibida':'received',
 'comercial':'commercial','tecnico':'technical','técnico':'technical','tecnica':'technical','técnica':'technical',
 'interno':'internal','interna':'internal','general':'general','manual':'manual',
}

def iter_files(root:Path):
    for base in SCAN_DIRS:
        d=root/base
        if not d.exists(): continue
        for p in sorted(d.rglob('*')):
            if not p.is_file() or p.suffix.lower() not in TEXT_SUFFIXES: continue
            rel=p.relative_to(root).as_posix()
            if rel.startswith(SKIP_PREFIXES): continue
            if any(part in SKIP_DIRS for part in p.parts): continue
            yield p

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--app',required=True); ap.add_argument('--apply',action='store_true'); ap.add_argument('--output',required=True)
    args=ap.parse_args(); root=Path(args.app).resolve(); changes=[]
    patterns=[(re.compile(rf'(?<![{WORD_CHARS}]){re.escape(old)}(?![{WORD_CHARS}])'),new,old) for old,new in sorted(REPLACEMENTS.items(), key=lambda x: len(x[0]), reverse=True)]
    for p in iter_files(root):
        text=p.read_text(encoding='utf-8')
        new=text; count=0
        for rx,repl,old in patterns:
            new,c=rx.subn(repl,new); count+=c
        if new!=text:
            changes.append({'file':p.relative_to(root).as_posix(),'replacements':count})
            if args.apply: p.write_text(new,encoding='utf-8')
    out=Path(args.output); out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps({'apply':args.apply,'changes':changes},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'apply':args.apply,'files':len(changes),'replacements':sum(c['replacements'] for c in changes),'output':str(out)},ensure_ascii=False))
if __name__=='__main__': main()
