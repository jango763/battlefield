from pathlib import Path
import re,json,hashlib
root=Path(__file__).parent
original=(root/'preview-original.html').read_text()
integration=(root/'german-v2.js').read_text()
def once(old,new,text):
    if text.count(old)!=1: raise ValueError('Expected one hook: '+old[:90])
    return text.replace(old,new,1)
begin='// === Preview integration: German WW2 Panzergrenadier (red faction) ==='
end='// === End of preview integration ==='
a=original.index(begin);b=original.index(end,a)+len(end)
html=original[:a]+integration+original[b:]
html=once('if(moving)dust(o,dt);if(m.spr)', 'if(moving)dust(o,dt);if(o.germanPreview){animateGermanSoldier(o,dt);return}if(m.spr)',html)
html=once('U=U.filter(u=>{if(u.hp>0)return true;', 'U=U.filter(u=>{if(u.hp>0)return true;disposeGermanSoldier(u);',html)
html=once('dustUpdate(dt);pointsUpdate(dt);fogUpdate(dt);','refreshGermanPreviewLabel();dustUpdate(dt);pointsUpdate(dt);fogUpdate(dt);',html)
html=once('<button type="button" id="german-compare">🇩🇪 Сравнить немца</button>','',html)
html=once("U.push(u);if(t==='red'&&!cmd&&!eng)attachGermanSoldier(u);return u;","U.push(u);attachGermanSoldier(u);return u;",html)
assert html.count('pm.mf.getWorldPosition(mzV);')==2
html=html.replace('pm.mf.getWorldPosition(mzV);','(P.germanPreview?P.germanPreview.weapon.flash:pm.mf).getWorldPosition(mzV);')
html=once('<title>Серый наёмник: линия фронта</title>','<title>Серый наёмник — пехота v2</title>',html)
for i,m in enumerate(re.finditer(r'<script([^>]*)>(.*?)</script>',html,re.S)):
    if 'src=' not in m[1] and 'application/octet-stream' not in m[1]:
        (root/f'check-{i}.js').write_text(m[2])
(root/'preview-v2-built.html').write_text(html)
print(json.dumps({'bytes':len(html.encode()),'source_sha256':hashlib.sha256(original.encode()).hexdigest(),'integration_bytes':len(integration.encode())}))
