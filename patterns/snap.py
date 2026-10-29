import json,numpy as np
from PIL import Image,ImageFilter,ImageDraw
exec(open('process.py').read().split("def quantize")[0])   # PAL,names,rgb,lab,wrapstrip,W,H
exec("def fan"+open('process.py').read().split("def fan")[1].split("P=json.load")[0])
T=[1.0,0.7,0.45,0.25]
TR=np.array([[c*t+255*(1-t) for t in T] for c in rgb]).reshape(-1,3); TL=lab(TR)
pal=json.load(open("palette.json")); pal["tint_levels"]={"factors":T,"rule":"hue must be one of the 14 pigments; lighter tints (pigment*f + white*(1-f)) model watercolour density and are NOT violations","tints":{n:["#%02X%02X%02X"%tuple(int(round(v)) for v in TR[i*4+j]) for j in range(4)] for i,n in enumerate(names)}}
json.dump(pal,open("palette.json","w"),ensure_ascii=False,indent=1)
p=json.load(open('palette.json'))
T=np.array(sorted({tuple(int(h[i:i+2],16) for i in (1,3,5)) for v in p['tint_levels']['tints'].values() for h in v}|{(255,255,255)}),float)
TL=lab(T); Ts={tuple(map(int,t)) for t in T}
def off(a):
    u=np.unique(a.reshape(-1,3),axis=0); return sum(tuple(map(int,c)) not in Ts for c in u)
d=json.load(open('index.json'))
for e in d['items']:
    a=np.asarray(Image.open(e['file']).convert('RGB'))
    if e['compliant']:
        u,inv=np.unique(a.reshape(-1,3),axis=0,return_inverse=True)
        m=T[((lab(u.astype(float))[:,None]-TL[None])**2).sum(-1).argmin(1)].astype(np.uint8)
        a=m[inv.ravel()].reshape(a.shape); im=Image.fromarray(a); im.save(e['file'])
        im.crop((0,310,4096,1738)).save(e['crop_cup'])
        fan(im.resize((2048,1024),Image.NEAREST).crop((0,155,2048,869)).resize((W,H),Image.NEAREST),e['preview'])
    e['offpalette_colors']=off(a); c=np.asarray(Image.open(e['crop_cup']).convert('RGB'))
    e['offpalette_colors_crop']=off(c)
    print(e['id'],e['offpalette_colors'],e['offpalette_colors_crop'],flush=True)
d['offpalette_rule']="offpalette_colors = number of distinct RGB values not equal to an exact palette tint (palette.json tint_levels) or #FFFFFF"
json.dump(d,open('index.json','w'),ensure_ascii=False,indent=1)
