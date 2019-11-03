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
  uniform float u_camera_fov;
  uniform float u_camera_aspect;
  uniform mat4  u_view_matrix;
  uniform vec2  u_dim;

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
    return 2.0 * depth * tan(u_camera_fov * 0.5 *(PI / float(180)));
  }
  float GetFrustrumWidth(float depth) {
    return GetFrustrumHeight(depth) * u_camera_aspect;
  }

  vec3 PositionToClusterVec3(vec3 position) {
    // Takes in a position and calculates what cluster belongs to it
    // Position is in View space, so it relates directly to our view stuff
    // Need some bounds for the view frustrum
    vec4 view_pos = u_view_matrix * vec4(position, 1.0);

    // I got help on figuring this one out. Not sure how it works still.
    // But we choose to define the z cluster logarithmically
    // So far away clusters are larger. And z depth dictates the width/height
    // of the frustrum
    float z = log(-view_pos.z) 
            * (u_z_slices / log(u_camera_far/u_camera_near)) 
            - ((u_z_slices * log(u_camera_near)) / log(u_camera_far / u_camera_near));

    // Just like in base.js
    float zMin = u_camera_near;
    float zMax = u_camera_far;
    float zDepth = zMin * pow((zMax / zMin), ((float(z) + 1.0) / float(u_z_slices)));;
    float width  = GetFrustrumWidth(zDepth);
    float height = GetFrustrumHeight(zDepth);

    // Armed with the above, get x, y, and z
    // IDK why true_pos wont work.
    int x = int(((view_pos.x + (width/2.0)) / width) * u_x_slices);
    int y = int(((view_pos.y + (height/2.0)) / height) * u_y_slices);
 
    return vec3(x, y, int(z));
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

    // Get cluster info
    vec3 debug_clusterColor = PositionToClusterVec3(v_position);
    debug_clusterColor.x /= u_x_slices;
    debug_clusterColor.y /= u_y_slices;
    debug_clusterColor.z /= u_z_slices;

    int clusterIdx = PositionToCluster(v_position);
    int totalClusters = int(u_x_slices * u_y_slices * u_z_slices);

    // Calculate index for going into u_clusterBuffer
    float tid = float(clusterIdx+1) / float(totalClusters+1);

    int numLights = int(texture2D(u_clusterbuffer, vec2(tid, 0))[0]);
    float clusterBufferStep = ((100.0 + 1.0) / 4.0) + 1.0;

    for (int i = 0; i < ${params.numLights}; ++i) {
      // GLSL wont allow a non-const as the for loop compartor
      // What a piece of trash
      if (i >= numLights) {
        break;
      }

      // Get the light data from clusterBuffer
      float lid = (float(i) / 101.0) / 4.0;
      vec4 lightData = texture2D(u_clusterbuffer, vec2(tid, lid));
      
      int dataidx = int(float(i) - 4.0 * floor(float(i)/4.0));
      //float light_index = lightData[int(dataidx)]; // WTF GLSL
      float light_index = 0.0;
      if(dataidx == 0) {
        light_index = lightData[0];
      }
      if(dataidx == 1) {
        light_index = lightData[1];
      }
      if(dataidx == 2) {
        light_index = lightData[2];
      }
      if(dataidx == 3) {
        light_index = lightData[3];
      }

      // About the same as before
      Light light = UnpackLight(int(light_index));
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
