#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;
uniform mat4 u_viewProjectionMatrix;

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

void main() {
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));

    // TODO: populate your g buffer
    // Want to do it how LeadWerks does (only storing the depth, and reconstructing
    // position that and the frag position. But no time to change frag code

    // Inspired by https://stackoverflow.com/questions/29251819/efficient-way-to-store-3d-normal-vector-using-two-floats
    gl_FragData[0] = vec4(v_position, norm.x);
    gl_FragData[1] = vec4(col, norm.y);
}