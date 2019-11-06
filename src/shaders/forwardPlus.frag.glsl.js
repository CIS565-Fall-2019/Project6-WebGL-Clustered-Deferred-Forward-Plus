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

  // Additional info needed for cluster access
  uniform float u_camera_near;
  uniform float u_camera_far;
  uniform float u_camera_width;
  uniform float u_camera_height;
  uniform float u_camera_fov;
  uniform float u_camera_aspect;
  uniform mat4  u_view_matrix;
  uniform vec2  u_dim;
  uniform float u_max_lights;

  uniform float u_x_slices;
  uniform float u_y_slices;
  uniform float u_z_slices;

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

  // https://docs.unity3d.com/Manual/FrustumSizeAtDistance.html
  float GetFrustrumHeight(float depth) {
    float PI = 3.1415926535897932384626433832795;
    return 2.0 * depth * tan(u_camera_fov * 0.5 * (PI / float(180)));
  }
  float GetFrustrumWidth(float depth) {
    return GetFrustrumHeight(depth) * u_camera_aspect;
  }

  vec3 PositionToClusterVec3(vec3 position) {
    // Takes in a position and calculates what cluster belongs to it
    // Position is in View space, so it relates directly to our view stuff
    // Need some bounds for the view frustrum
    vec4 view_pos = u_view_matrix * vec4(position, 1.0);
    float width  = u_camera_width;//GetFrustrumWidth(zDepth);
    float height = u_camera_height;//GetFrustrumHeight(zDepth);
    float depth  = u_camera_far - u_camera_near;

    // Armed with the above, get x, y, and z
    // For x and y, we add width/2 to get in the range 0, width.
    // We then divide by width to get a percentage of the width
    // We lastly we multiply by the number of slices and floor it to get a cluster idx.
    float x = floor(((view_pos.x + (width/2.0)) / width) * u_x_slices);
    float y = floor(((view_pos.y + (height/2.0)) / height) * u_y_slices);
    float z = floor(u_z_slices - log2(depth / (-view_pos.z - u_camera_near)));

    return vec3(int(x), int(y), int(z));
  }

  int PositionToCluster(vec3 position) {
    // Takes in a position and calculates what cluster belongs to it
    // Position is in View space, so it relates directly to our view stuff
    // Need some bounds for the view frustrum
    vec3 p = PositionToClusterVec3(position);
    return int(p.x) + int(p.y) * int(u_x_slices) + int(p.z) * int(u_x_slices) * int(u_y_slices);
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

    // Get cluster info for debug. This was super helpful.
    vec3 debug_clusterColor = PositionToClusterVec3(v_position);
    debug_clusterColor.x /= u_x_slices;
    debug_clusterColor.y /= u_y_slices;
    debug_clusterColor.z /= u_z_slices;

    int clusterIdx = PositionToCluster(v_position);
    int totalClusters = int(u_x_slices * u_y_slices * u_z_slices);

    // Calculate index for going into u_clusterBuffer
    float clusterBufferIdx = float(clusterIdx+1) / float(totalClusters+1);
    int numLights = int(texture2D(u_clusterbuffer, vec2(clusterBufferIdx, 0))[0]);

    // So this was the hardest part for me.
    // Each buffer is num_cluster wide, and clusterBufferStep deep
    // But its measured in PIXELS, not floats.
    // So we take max_lights + 1 (gotta remmber the light count)
    // and then divide by 4 cause xyza. Then we add one for
    // a reason I still can't figure out, but i was told to do so by
    // the CG Gods. And so I must appease them.
    int clusterBufferStep = int(floor((u_max_lights + 1.0) / 4.0) + 1.0);

    // For each light
    for (int i = 0; i < ${params.numLights}; ++i) {
      // GLSL wont allow a non-const as the for loop compartor
      // What a piece of trash
      if (i >= numLights) {
        break;
      }

      float light_index = ExtractFloat(
        u_clusterbuffer,
        totalClusters,
        clusterBufferStep,
        clusterIdx,
        i+1); // Don't want item 0, the light count.

      // About the same as before
      Light light = UnpackLight(int(light_index));
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      
      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

      // Blinn-Phong
      // https://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_reflection_model
      if(lambertTerm > 0.0) {
        vec4 view_pos = u_view_matrix * vec4(v_position, 1.0);
        vec3 specularColor = vec3(0.5, 0.5, 0.5);
        vec3 H = normalize(normalize(L) + normalize(-view_pos.xyz));
        float specularAngle = max(dot(normal, H), 0.0);
        float specularIntensity = pow(specularAngle, 0.7); // Hardcoded shiniess.
        fragColor += specularIntensity * light.color * vec3(lightIntensity);
      }
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    // Debug values
    //debug_clusterColor.x = 0.0;
    //debug_clusterColor.y = 0.0;
    //debug_clusterColor.z = 0.0;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
