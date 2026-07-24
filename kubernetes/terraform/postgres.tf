resource "kubernetes_secret" "postgres_secret" {
  metadata {
    name      = "postgres-secret"
    namespace = kubernetes_namespace.microservices.metadata[0].name
  }

  type = "Opaque"

  data = {
    POSTGRES_USER     = "user"
    POSTGRES_PASSWORD = "password"
    POSTGRES_DB       = "userdb"
  }
}

resource "kubernetes_deployment" "postgres" {
  metadata {
    name      = "postgres"
    namespace = kubernetes_namespace.microservices.metadata[0].name
    labels = {
      app = "postgres"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "postgres"
      }
    }

    template {
      metadata {
        labels = {
          app = "postgres"
        }
      }

      spec {
        container {
          name  = "postgres"
          image = "localhost:5000/postgres:latest"

          port {
            container_port = 5432
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.postgres_secret.metadata[0].name
            }
          }

          resources {
            requests = {
              memory = "128Mi"
              cpu    = "50m"
            }
            limits = {
              memory = "256Mi"
              cpu    = "300m"
            }
          }

          readiness_probe {
            exec {
              command = ["pg_isready", "-U", "user"]
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }

          liveness_probe {
            exec {
              command = ["pg_isready", "-U", "user"]
            }
            initial_delay_seconds = 15
            period_seconds        = 20
          }

          volume_mount {
            name       = "postgres-storage"
            mount_path = "/var/lib/postgresql/data"
          }
        }

        volume {
          name = "postgres-storage"
          empty_dir {}
        }
      }
    }
  }
}

resource "kubernetes_service" "postgres" {
  metadata {
    name      = "postgres"
    namespace = kubernetes_namespace.microservices.metadata[0].name
  }

  spec {
    selector = {
      app = "postgres"
    }

    port {
      port        = 5432
      target_port = 5432
    }

    type = "ClusterIP"
  }
}