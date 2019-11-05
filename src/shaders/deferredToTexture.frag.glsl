#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
}

vec2 octWrap(vec2 v) {
    float sig1 = (v.x >= 0.0) ? 1.0 : -1.0;
    float sig2 = (v.y >= 0.0) ? 1.0 : -1.0;
    return (1.0 - abs(v.xy)) * vec2(sig1, sig2);
    //return (1.0 - abs(v.yx)) * vec2(sign(v.x), sign(v.y));
}

vec2 encode(vec3 n)
{
    n /= ( abs( n.x ) + abs( n.y ) + abs( n.z ) );
    n.xy = (n.z >= 0.0) ? n.xy : octWrap( n.xy );
    n.xy = n.xy * 0.5 + 0.5;
    return n.xy;
}

void main() {
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));

    
    // Compressing the normal as it is a unit vector and we can calculate using x and y components for the magnitude
    // For sign, make one of the color component as negative, for checking the sign.
    
    //vec2 normalNew = encode(norm); 
    //gl_FragData[0] = vec4(v_position, normalNew.x);
    //gl_FragData[1] = vec4(col, normalNew.y);

    // Baseline Code
     gl_FragData[0] = vec4(v_position, 1.0);
     gl_FragData[1] = vec4(col, 1.0);
     gl_FragData[2] = vec4(norm, 1.0);

}