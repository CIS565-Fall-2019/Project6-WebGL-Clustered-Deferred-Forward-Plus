export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // uniform variables for camera

  uniform mat4 u_viewMatrix;

  uniform float u_farClip;
  uniform float u_nearClip;

  uniform float u_nearWidth;
  uniform float u_nearHeight;

  uniform float u_farWidth;
  uniform float u_farHeight;

  uniform float u_xSlices;
  uniform float u_ySlices;
  uniform float u_zSlices;


  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

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

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    float u = float(index + 1) / float(textureWidth + 1);
    int pixel = component / 4;
    float v = float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    int pixelComponent = component - pixel * 4;
    if (pixelComponent == 0) {
      return texel[0];
    } else if (pixelComponent == 1) {
      return texel[1];
    } else if (pixelComponent == 2) {
      return texel[2];
    } else if (pixelComponent == 3) {
      return texel[3];
    }
  }

  Light UnpackLight(int index) {
    Light light;
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

    light.color = v2.rgb;
    return light;
  }

  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 fragColor = vec3(0.0);

    // Project fragment v from world coordinates to camera view coorndinates
    vec4 viewPos =  u_viewMatrix * vec4(v_position, 1.0);

    // Compute the x-y plane's (where v lies) width and height based on the depth
    float depthFactor = ((abs(viewPos.z) - u_nearClip)/((1.0 * u_farClip) - (1.0 * u_nearClip) ));
    float xyplaneWidth = u_nearWidth + ((u_farWidth - u_nearWidth) * depthFactor);
    float xyplaneHeight = u_nearHeight + ((u_farHeight - u_nearHeight) * depthFactor);
    
    // Find cluster indices x,y,z where the fragment v lies
    // Shift the x and y indices by half H and half W to make the indices positive 
    int z = int(depthFactor / u_zSlices);
    int x = int((viewPos.x + 0.5 * xyplaneWidth) / (xyplaneWidth / u_xSlices));
    int y = int((viewPos.y + 0.5 * xyplaneHeight) / (xyplaneHeight / u_ySlices));
    
    // Read in the lights in that cluster from the u_clusterbuffer populated in base.js
    // get linearised cluster id (to access u_clusterbuffer) based on point v_position
    int idx = x +  y * int(u_xSlices)  +  z * int(u_xSlices) * int(u_ySlices); 
    int numLightsCluster = int(ExtractFloat(u_clusterbuffer, ${params.clusterTextureWidth}, ${params.clusterTextureHeight}, idx, 0));

    // Do shading for just lights in this cluster
    for(int lidx = 1; lidx < ${params.clusterTextureHeight} * 4 - 1; ++lidx){
      if(lidx > numLightsCluster) {
        break;
      }
      int lightId = int(ExtractFloat(u_clusterbuffer, ${params.clusterTextureWidth}, ${params.clusterTextureHeight}, idx, lidx));
      Light light = UnpackLight(lightId);

    // }
    // for (int i = 0; i < ${params.numLights}; ++i) {
    //   Light light = UnpackLight(i);

      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
