"""Create an actual path-only SVG wordmark; fontTools is only a design-time tool."""
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[1]
local_tools=root/'.cache'/'vector-tools'
if local_tools.exists():
    sys.path.insert(0,str(local_tools))
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import re

font=TTFont(root/'design'/'fonts'/'GochiHand.ttf')
glyphs=font.getGlyphSet()
cmap=font.getBestCmap()
units=font['head'].unitsPerEm

def lettering(text,x,y,size,target_width):
    advance=sum(glyphs[cmap[ord(c)]].width for c in text)
    scale=min(size/units,target_width/advance)
    paths=[]
    for i,char in enumerate(text):
        glyph=glyphs[cmap[ord(char)]]
        pen=SVGPathPen(glyphs)
        # Slight baseline variations reinforce the hand-lettered, marker rhythm.
        drift=[0,-.8,.5,-.3,.6,-.4,0,.4,-.5][i%9]
        glyph.draw(TransformPen(pen,(scale,0,0,-scale,x,y+drift)))
        paths.append(f'<path d="{pen.getCommands()}"/>')
        x+=glyph.width*scale
    return '\n'.join(paths)

# Two nested organic contours create a real filled marker stroke with variable
# pressure. This is not a uniform-width stroked polygon.
house='M13 106 Q10 82 10 54 Q48 36 109 8 Q137 17 161 39 L166 8 Q178 8 191 12 L196 55 Q216 63 230 72 L232 110 Q155 116 78 110 Z M20 101 Q80 104 156 106 L225 104 L224 76 Q210 69 191 60 L185 17 L174 15 L169 47 Q139 25 110 15 Q50 41 17 58 Z'
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 244 120" fill="#233545">
<title>EventsDormitory — рисованный дом</title>
<path d="{house}" fill-rule="evenodd"/>
<g>{lettering('Events',43,65,36,126)}</g>
<g>{lettering('Dormitory',29,95,37,178)}</g>
</svg>'''
(root/'web'/'assets'/'logo.svg').write_text(svg,encoding='utf-8')
html_file=root/'web'/'index.html'
html=html_file.read_text(encoding='utf-8')
inline=svg.replace('<svg ', '<svg class="brand-mark" aria-hidden="true" ',1)
html,count=re.subn(r'<svg\s+class="brand-mark"[\s\S]*?</svg>',lambda _:inline,html,count=1)
assert count==1
html_file.write_text(html,encoding='utf-8')
print('Logo: vector paths, no runtime font dependency')
