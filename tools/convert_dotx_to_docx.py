import argparse
import io
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types'
NSMAP = {'ct': CT_NS}
W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'


def fix_content_types(data: bytes) -> bytes:
    tree = ET.fromstring(data)
    changed = False
    for override in tree.findall('ct:Override', NSMAP):
        if override.attrib.get('PartName') == '/word/document.xml':
            override.set(
                'ContentType',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
            )
            changed = True
    if not changed:
        return data
    return ET.tostring(tree, encoding='utf-8', xml_declaration=True)


def strip_attached_template(data: bytes) -> bytes:
    tree = ET.fromstring(data)
    removed = False
    for parent in tree.iter():
        for child in list(parent):
            if child.tag == f'{{{W_NS}}}attachedTemplate':
                parent.remove(child)
                removed = True
    if not removed:
        return data
    return ET.tostring(tree, encoding='utf-8', xml_declaration=True)


def convert_dotx(input_path: Path, output_path: Path) -> None:
    buf = io.BytesIO()
    with zipfile.ZipFile(input_path, 'r') as src, zipfile.ZipFile(buf, 'w') as dest:
        for name in src.namelist():
            data = src.read(name)
            if name == '[Content_Types].xml':
                data = fix_content_types(data)
            elif name == 'word/settings.xml':
                data = strip_attached_template(data)
            dest.writestr(name, data)
    output_path.write_bytes(buf.getvalue())


def main() -> None:
    parser = argparse.ArgumentParser(description='Convert .dotx templates into editable .docx.')
    parser.add_argument('root', type=Path, help='Root folder containing copied templates.')
    parser.add_argument('--dry-run', action='store_true', help='List the conversions without writing files.')
    args = parser.parse_args()

    dotx_files = list(args.root.rglob('*.dotx'))
    if not dotx_files:
        print('No .dotx files under', args.root)
        return

    for dotx in dotx_files:
        docx_path = dotx.with_suffix('.docx')
        if docx_path.exists():
            continue
        if args.dry_run:
            print('would convert', dotx)
            continue
        convert_dotx(dotx, docx_path)
        print('converted', dotx, '->', docx_path)


if __name__ == '__main__':
    main()
