#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform mat4 u_viewMatrix;
uniform sampler2D u_colmap;
uniform sampler2D u_normap;

uniform ivec3 u_numslices;
uniform vec4 u_filmextents;/*0: fov, 1: aspectratio, 2: near, 3: far */

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;


int indexZ(float near, float far, int numslices, float pos) {
	float logFarOverNear = log(far / near);
	float sliceNum = log(pos) * (float(numslices) / logFarOverNear) - ((float(numslices) * log(near)) / logFarOverNear);
	return int(sliceNum);
}

ivec2 indicesLinear(int numslicesX, int numslicesY, vec3 screenPos, int zIndex) {
	float zDistFar = u_filmextents.z * pow((u_filmextents.w / u_filmextents.z), ((float(zIndex) + 1.0) / float(u_numslices.z)));
	float halfTangent = tan(radians(u_filmextents.x * 0.5));
	float frustumHeight = 2.0 * zDistFar * halfTangent;
	float frustumWidth = frustumHeight * u_filmextents.y;
	float xPercentage = (screenPos.x + (frustumWidth * 0.5)) / frustumWidth;
	float yPercentage = (screenPos.y + (frustumHeight * 0.5)) / frustumHeight;
	int xIndex = int(xPercentage * float(numslicesX));
	int yIndex = int(yPercentage * float(numslicesY));
	return ivec2(xIndex, yIndex);
}

ivec3 index3ForScreenPosition(vec3 screenPos) {
	float z = -1.0 * screenPos.z;
	int zIndex = indexZ(u_filmextents.z, u_filmextents.w, u_numslices.z, z);
	ivec2 xyIndex = indicesLinear(u_numslices.x, u_numslices.y, screenPos, zIndex);
	return ivec3(xyIndex.x, xyIndex.y, zIndex);
}

int indexForScreenPosition(vec3 screenPos) {
	ivec3 i3 = index3ForScreenPosition(screenPos);
	return (i3.x + i3.y * u_numslices.x + i3.z * u_numslices.x * u_numslices.y);
}

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
}

int packIndices(ivec3 indices) {
	return (indices.x + indices.y * 256 + indices.z * 256 * 256);
}

ivec3 unpackIndices(int indices) {
	int zval = indices / (256 * 256);
	int working = indices - (zval * 256 * 256);
	int yval = working / 256;
	working = working - (yval * 256);
	int xval = working;
	return ivec3(xval, yval, zval);
}

void main() {
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));

	vec4 vPos = vec4(v_position, 1.0);
	vec4 ssPos = u_viewMatrix * vPos;
	ivec3 indices = index3ForScreenPosition(ssPos.xyz);

	gl_FragData[0] = vec4(v_position, packIndices(indices));
	gl_FragData[1] = vec4(norm, 1.0);
	gl_FragData[2] = vec4(col, 1.0);
}