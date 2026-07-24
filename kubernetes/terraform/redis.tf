resource "kubernetes_deployment" "redis" {
  metadata {
    name      = "redis"
    namespace = kubernetes_namespace.microservices.metadata[0].name
    labels = {
      app = "redis"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "redis"
      }
    }

    template {
      metadata {
        labels = {
          app = "redis"
        }
      }

      spec {
        container {
          name    = "redis"
          image   = "redis:7-alpine"
          command = ["redis-server", "--appendonly", "yes"]

          port {
            container_port = 6379
          }

          resources {
            requests = {
              memory = "32Mi"
              cpu    = "25m"
            }
            limits = {
              memory = "128Mi"
              cpu    = "150m"
            }
          }

          readiness_probe {
            exec {
              command = ["redis-cli", "ping"]
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }

          liveness_probe {
            exec {
              command = ["redis-cli", "ping"]
            }
            initial_delay_seconds = 10
            period_seconds        = 15
          }

          volume_mount {
            name       = "redis-storage"
            mount_path = "/data"
          }
        }

        volume {
          name = "redis-storage"
          empty_dir {}
        }
      }
    }
  }
}

resource "kubernetes_service" "redis" {
  metadata {
    name      = "redis"
    namespace = kubernetes_namespace.microservices.metadata[0].name
  }

  spec {
    selector = {
      app = "redis"
    }

    port {
      port        = 6379
      target_port = 6379
    }

    type = "ClusterIP"
  }
}