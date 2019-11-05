export default function(params) {
  return `
  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  // Additional uniforms
  uniform float u_screen_width;
  uniform float u_screen_height;
  uniform mat4 u_view_matrix;
  uniform float u_near;
  uniform float u_far;
  uniform vec3 u_camera_pos;

  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
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
  
   vec3 Decode( vec2 temp )
  {
    temp = temp * 2.0 - 1.0;
    vec3 n = vec3(temp.x, temp.y, 1.0 - abs(temp.x) - abs(temp.y));
    float t = clamp(-n.z, 0.0, 1.0);
    n.x += n.x >= 0.0 ? -t : t;
    n.y += n.y >= 0.0 ? -t : t;
    return normalize(n);
  }

  void main() {
    // TODO: extract data from g buffers and do lighting

    // Unoptimized
    // vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    // vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    // vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    // vec3 v_position = gb0.rgb;
    // vec3 albedo = gb1.rgb;
    // vec3 normal = gb2.rgb;

    // Optimized
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    vec3 v_position = gb0.xyz;
    vec3 albedo = gb1.rgb;
    vec2 enc_norm = vec2(gb0.w, gb1.w);
    vec3 normal = Decode(enc_norm);

    // The code below is similar as that of forward plus

    // Camera Position
    vec4 camera_pos = u_view_matrix * vec4(v_position, 1.0);

    int cluster_count = ${params.xSlices} * ${params.ySlices} * ${params.zSlices};
    int pixels_per_element = int(float(${params.maxLightsPerCluster} + 1) / 4.0) + 1;

    // Extract Cluster 
    int cluster_x = int((gl_FragCoord.x * float(${params.xSlices})) / u_screen_width);
    int cluster_y = int((gl_FragCoord.y * float(${params.ySlices})) / u_screen_height);
    int cluster_z = int(((-camera_pos.z - u_near) * float(${params.zSlices})) / (u_far - u_near));
    int cluster_idx = cluster_x + cluster_y * ${params.xSlices} + cluster_z * ${params.xSlices} * ${params.ySlices};
  
    // Find number of lights
    int lights_num = int(ExtractFloat(u_clusterbuffer, cluster_count, pixels_per_element,  cluster_idx, 0)); 
    vec3 fragColor = vec3(0.0);

    for (int i = 0; i < ${params.numLights}; ++i) {
      if (i >= lights_num) {
        break;
      }
      
      // Find ith light's index
      int light_idx = int(ExtractFloat(u_clusterbuffer, cluster_count, pixels_per_element,  cluster_idx, i + 1)); 
          
      Light light = UnpackLight(light_idx);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

      // Blinn-Phong shading effect
      // https://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_reflection_model
      vec3 light_direction = normalize(light.position - u_camera_pos);
      vec3 view_direction = normalize(v_position - u_camera_pos);
      vec3 half_way_direction = normalize(light_direction + view_direction);
      float specular = pow(max(dot(normal, half_way_direction), 0.0), 2.0);
      fragColor += specular * light.color * 0.01;
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;
    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}