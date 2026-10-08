"""Optimize generated originals into project-local web assets (Pillow)."""
from pathlib import Path
from PIL import Image
import sys

source = Path(sys.argv[1])
dest = Path(__file__).resolve().parents[1] / 'web' / 'assets'
dest.mkdir(parents=True, exist_ok=True)
files = {
    'dormitory': 'exec-47901211-880a-4557-aa39-18481604d37c.png',
    'ml': 'exec-4cc128b3-8158-41c9-b99d-c72630a3f504.png',
    'sport': 'exec-068717e1-187c-4984-9b4d-75a545a5c94a.png',
    'halloween': 'exec-f0f57a51-fff7-4e5f-a45d-85bfb062985b.png',
    'vibe': 'exec-f0d37b40-623a-46a7-a946-15143ebab805.png',
    'games': 'exec-21baab00-6d2e-4ec5-8326-5b4a3f7cff5c.png',
    'cinema': 'exec-cbc834b1-c9d1-44d8-b623-b0556c60c740.png',
}
for name, file in files.items():
    im = Image.open(source / file).convert('RGB')
    im.thumbnail((1440, 1200))
    im.save(dest / f'{name}.webp', quality=86, method=6)
    print(name, (dest / f'{name}.webp').stat().st_size)
