#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;

uniform mat4 u_viewMatrix;
uniform mat4 u_viewProjectionMatrix;

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
}

void main() {
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));

    //gl_FragData[0] = vec4(col, 1.0);//albedo
    //gl_FragData[1] = vec4(v_position, 1.0);//vpos
    //gl_FragData[2] = vec4(norm, 1.0);

    //gl_FragData[0] = vec4(col, 1.0);//albedo
    //gl_FragData[1] = vec4(v_position, 1.0);//vpos

    //optimize
    norm = normalize(norm);
    norm.xy = normalize(norm.xy) * (sqrt(-norm.z * 0.5 + 0.5));
    norm.xy = norm.xy * 0.5 + 0.5;

    vec4 p = u_viewMatrix * vec4(v_position, 1.0);
    vec4 pNDC = u_viewProjectionMatrix * vec4(v_position, 1.0);
    pNDC /= pNDC.w;

    gl_FragData[0] = vec4(col, pNDC.z);//albedo
    gl_FragData[1] = vec4(norm.xy, p.z, 1.0);//vpos
}