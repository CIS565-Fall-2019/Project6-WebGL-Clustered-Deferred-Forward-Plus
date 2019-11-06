export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;
  uniform float u_nearWidth;
  uniform float u_nearHeight;
  uniform float u_farWidth;
  uniform float u_farHeight;
  uniform float u_far;
  uniform float u_near;
  uniform int u_xSlices;
  uniform int u_ySlices;
  uniform int u_zSlices;
  uniform mat4 u_viewMatrix;
  uniform vec3 u_cameraPos;

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

    vec4 pos = u_viewMatrix * vec4(v_position, 1.0);

    float lambda = (abs(pos.z) - u_near)/(u_far*1.0 - u_near*1.0);
    float u_width = u_nearWidth + (u_farWidth-u_nearWidth)*lambda;
    float u_height = u_nearHeight + (u_farHeight-u_nearHeight)*lambda;

    float xstep = u_width/float(u_xSlices);
    float ystep = u_height/float(u_ySlices);
    float zstep = (u_far - u_near)/float(u_zSlices);

    int x = int(floor((pos.x + 0.5*u_width)/xstep));
    int y = int(floor((pos.y + 0.5*u_height)/ystep));
    int z = int(floor((abs(pos.z) - u_near)/zstep));

    int clusterId = x + y * u_xSlices + z * u_xSlices * u_ySlices;
  
    int numLights = int(ExtractFloat(u_clusterbuffer, 
      ${params.textureWidth}, ${params.textureHeight}, clusterId, 0));

    for (int i = 1; i < ${params.textureHeight}*4-1; ++i) {
      
      if(i > numLights) {
        break;
      }

      int lightId = int(ExtractFloat(u_clusterbuffer, 
        ${params.textureWidth}, ${params.textureHeight}, clusterId, i));

      Light light = UnpackLight(lightId);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      // Bling-Phong
      vec3 lightCameraDir = normalize(light.position - u_cameraPos);
      vec3 lightToPoint = normalize(light.position - v_position);
      vec3 halfDir = normalize(lightCameraDir + lightToPoint);

      float spec = pow(max(dot(normal, halfDir), 0.0), 2.0);
      vec3 specColor = 0.01 * spec * light.color;

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      fragColor += specColor;
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
