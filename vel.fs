var vel_fragmentShaderText = `

precision highp float;

uniform sampler2D pos_texture;
uniform sampler2D vel_texture;
uniform float iTime;
uniform vec2 iResolution;
uniform vec2 iMouse;
uniform vec2 mPos[6];

varying vec2 v_position;

#define PI 3.14159265359

float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}
float noise(vec3 p){vec3 a = floor(p);vec3 d = p - a;d = d * d * (3.0 - 2.0 * d);vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);vec4 k1 = perm(b.xyxy);vec4 k2 = perm(k1.xyxy + b.zzww);vec4 c = k2 + a.zzzz;vec4 k3 = perm(c);vec4 k4 = perm(c + 1.0);vec4 o1 = fract(k3 * (1.0 / 41.0));vec4 o2 = fract(k4 * (1.0 / 41.0));vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);return o4.y * d.y + o4.x * (1.0 - d.y);}
#define numOctaves 4
float fbm(vec2 x){float G = exp2(-1.);float f = 1.0;float a = 1.0;float t = 0.0;for( int i=0; i<numOctaves; i++ ){t += a*noise(vec3(f*x,iTime*0.1));f *= 2.0;a *= G;}return t;}
float pattern(vec2 p ){vec2 q = vec2( fbm( p + vec2(0.0,0.0) ),fbm( p + vec2(5.2,1.3) ) );vec2 r = vec2( fbm( p + 4.0*q + vec2(1.7,9.2) ),fbm( p + 4.0*q + vec2(8.3,2.8) ) );return fbm( p + 4.0*r );}
mat2 Rot(float a) {float s = sin(a);float c = cos(a);return mat2(c, -s, s, c);}

float rand(vec2 co) {
    float t = dot(vec2(12.9898, 78.233), co);
    return fract(sin(t) * (4375.85453 + t));
}

vec2 updateVel(vec2 p, vec2 v, vec2 m){	
	p *= iResolution.xy / iResolution.y;
	//float nval = noise(vec3((p)*10.,0.));
	//nval *= 2.;
	//nval = smoothstep(0.,2.,nval);
	float nval = pattern(vec2(p*0.4));
	float angle = nval*PI*2.;
	//float magnitude = 0.0001;
	vec2 acceleration = vec2(sin(angle),cos(angle));//*magnitude;
	vec2 mf = 0.1*normalize(m-p)/(length(m-p));
	mf *= Rot(PI/2.);
	mf += 0.08*normalize(p-m)/(length(m-p));
	mf *= iResolution.x / iResolution.xy;
	acceleration += mf;
	
	//vec2 add;
	for(int i=0; i<6; i++){
		vec2 mpos = mPos[i]/iResolution.xy;
		mpos.x *= iResolution.x/iResolution.y;
		mpos.y = mpos.y*-1.+1.;

		vec2 f = 0.1*normalize(mpos-p)/(length(mpos-p));
		f *= Rot(PI/2.);
		f += 0.08*normalize(p-mpos)/(length(mpos-p));
		f /= 3.;
		
		f *= iResolution.x / iResolution.xy;
		//if(length(mpos-p)<0.1){
		acceleration += f;
		//}
	}
	//add = normalize(add) * length(mf) * 2.;
	//acceleration += add;


	acceleration *= iResolution.x / iResolution.xy;

	vec2 newVel = v + acceleration;
	//float range = 0.003;
	//newVel.x = clamp(newVel.x,-range,range);
	//newVel.y = clamp(newVel.y,-range,range);
	newVel = normalize(newVel)*0.001;
	newVel *= iResolution.x / iResolution.xy;
	return newVel;
}

void main() {
	vec4 posColor = texture2D(pos_texture,v_position);
	vec2 pos = vec2(posColor.r / 255.0 + posColor.b, posColor.g / 255.0 + posColor.a);
	vec4 velColor = texture2D(vel_texture,v_position);
	vec2 vel = vec2(velColor.r / 255.0 + velColor.b, velColor.g / 255.0 + velColor.a);
	vec2 mousePos = iMouse / iResolution.xy;
	mousePos.x *= iResolution.x/iResolution.y;
	mousePos.y = mousePos.y*-1.+1.;

	vel = vel*2.-1.;
	vel = updateVel(pos,vel,mousePos);
	vel = vel*0.5+0.5;
  	gl_FragColor = vec4(fract(vel * 255.0),floor(vel * 255.0) / 255.0);
}

`;