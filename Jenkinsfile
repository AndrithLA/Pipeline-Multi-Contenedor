pipeline {
    agent any

    environment {
        APP_NAME = 'jenkins-microservices-app'
        DOCKER_COMPOSE_FILE = 'docker/docker-compose.test.yml'
        GIT_COMMIT_SHORT = "${env.GIT_COMMIT ? env.GIT_COMMIT.take(7) : 'local'}"
    }

    stages {
        stage('Verificar Código') {
            steps {
                echo 'Validando estructura del proyecto...'
                script {
                    def services = ['api-gateway', 'user-service', 'product-service']
                    services.each { service ->
                        if (!fileExists("services/${service}/package.json")) {
                            error "package.json no encontrado en ${service}"
                        }
                    }
                }
                echo 'Estructura válida.'
            }
        }

        stage('Pruebas de Contrato') {
            steps {
                echo 'Verificando contratos entre servicios...'
                sh 'node scripts/validate-contract.js services/user-service shared/contracts/user-contract.json'
                sh 'node scripts/validate-contract.js services/api-gateway shared/contracts/user-contract.json'
            }
        }

        stage('Build y Test por Servicio') {
            parallel {
                stage('API Gateway') {
                    steps {
                        buildAndTestService('api-gateway')
                    }
                }
                stage('User Service') {
                    steps {
                        buildAndTestService('user-service')
                    }
                }
                stage('Product Service') {
                    steps {
                        buildAndTestService('product-service')
                    }
                }
            }
        }

        stage('Pruebas de Integración con Servicios Reales') {
            steps {
                echo 'Levantando entorno completo de integración...'
                retry(3) {
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true"
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} --profile app up -d --build"
                }
                sh 'sleep 15'

                script {
                    // Jenkins corre en su propio contenedor, así que "localhost" no
                    // apunta a los servicios levantados por docker compose.
                    // Usamos un contenedor auxiliar conectado a la MISMA red,
                    // dirigiéndonos por nombre de servicio en vez de localhost.
                    env.APP_NETWORK = sh(
                        script: "docker compose -f ${DOCKER_COMPOSE_FILE} ps -q postgres | xargs docker inspect -f '{{range \$k,\$v := .NetworkSettings.Networks}}{{\$k}}{{end}}'",
                        returnStdout: true
                    ).trim()

                    sh """
                        echo "Esperando API Gateway..."
                        timeout 60 sh -c 'until docker run --rm --network ${env.APP_NETWORK} curlimages/curl -s -f http://api-gateway:3000/health; do sleep 2; done'

                        echo "Esperando User Service..."
                        timeout 60 sh -c 'until docker run --rm --network ${env.APP_NETWORK} curlimages/curl -s -f http://user-service:3001/health; do sleep 2; done'

                        echo "Esperando Product Service..."
                        timeout 60 sh -c 'until docker run --rm --network ${env.APP_NETWORK} curlimages/curl -s -f http://product-service:3002/health; do sleep 2; done'
                    """
                }

                echo 'Ejecutando pruebas funcionales de integración...'
                sh """
                    echo "=== Prueba: crear usuario via gateway ==="
                    HTTP_CODE=\$(docker run --rm --network ${env.APP_NETWORK} curlimages/curl -s -o /tmp/response.json -w "%{http_code}" -X POST http://api-gateway:3000/users \
                        -H "Content-Type: application/json" \
                        -d '{"name":"CI Test User","email":"ci-test-'\$(date +%s)'@example.com"}')
                    echo "HTTP Status: \$HTTP_CODE"
                    if [ "\$HTTP_CODE" != "201" ]; then
                        echo "ERROR - respuesta del servidor:"
                        docker run --rm --network ${env.APP_NETWORK} curlimages/curl -s -X POST http://api-gateway:3000/users \
                            -H "Content-Type: application/json" \
                            -d '{"name":"CI Test User 2","email":"ci-test-2-'\$(date +%s)'@example.com"}'
                        exit 1
                    fi

                    echo ""
                    echo "=== Prueba: listar productos ==="
                    docker run --rm --network ${env.APP_NETWORK} curlimages/curl -f http://product-service:3002/products
                """
            }
            post {
                always {
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} logs --tail=50 > integration-logs.txt || true"
                    archiveArtifacts artifacts: 'integration-logs.txt', allowEmptyArchive: true
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true"
                }
            }
        }

        stage('Pruebas de Carga y Rendimiento') {
            steps {
                echo 'Levantando entorno para pruebas de carga...'
                retry(3) {
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true"
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} --profile app up -d --build"
                }
                sh 'sleep 15'

                script {
                    def networkName = sh(
                        script: "docker compose -f ${DOCKER_COMPOSE_FILE} ps -q postgres | xargs docker inspect -f '{{range \$k,\$v := .NetworkSettings.Networks}}{{\$k}}{{end}}'",
                        returnStdout: true
                    ).trim()
                    env.APP_NETWORK = networkName

                    sh """
                        echo "Esperando API Gateway..."
                        timeout 60 sh -c 'until docker run --rm --network ${networkName} curlimages/curl -s -f http://api-gateway:3000/health; do sleep 2; done'

                        echo "Esperando User Service..."
                        timeout 60 sh -c 'until docker run --rm --network ${networkName} curlimages/curl -s -f http://user-service:3001/health; do sleep 2; done'

                        echo "Esperando Product Service..."
                        timeout 60 sh -c 'until docker run --rm --network ${networkName} curlimages/curl -s -f http://product-service:3002/health; do sleep 2; done'

                        echo "Margen extra para que el circuit breaker se estabilice..."
                        sleep 5
                    """
                }

                echo 'Ejecutando pruebas de carga con K6...'
                script {
                    sh 'docker build -t k6-loadtest:latest tests/performance'
                    sh """
                        docker run --rm --network ${env.APP_NETWORK} k6-loadtest:latest run /scripts/load-test.js
                    """
                }
            }
            post {
                always {
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true"
                }
            }
        }

        stage('Pruebas de Resiliencia') {
            steps {
                echo 'Probando resiliencia del sistema ante fallos de dependencias...'
                retry(3) {
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true"
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} --profile app up -d --build"
                }
                sh 'sleep 15'

                script {
                    env.APP_NETWORK = sh(
                        script: "docker compose -f ${DOCKER_COMPOSE_FILE} ps -q postgres | xargs docker inspect -f '{{range \$k,\$v := .NetworkSettings.Networks}}{{\$k}}{{end}}'",
                        returnStdout: true
                    ).trim()

                    sh """
                        echo "Esperando servicios antes de iniciar pruebas de caos..."
                        timeout 60 sh -c 'until docker run --rm --network ${env.APP_NETWORK} curlimages/curl -s -f http://user-service:3001/health; do sleep 2; done'
                    """

                    sh """
                        echo "=== Estado normal: todo conectado ==="
                        docker run --rm --network ${env.APP_NETWORK} curlimages/curl -s http://user-service:3001/health
                        echo ""

                        echo "=== Simulando fallo de Redis ==="
                        docker compose -f ${DOCKER_COMPOSE_FILE} stop redis
                        sleep 5

                        echo "Verificando que el sistema siga respondiendo..."
                        RESPONSE=\$(docker run --rm --network ${env.APP_NETWORK} curlimages/curl -s http://user-service:3001/health)
                        echo "\$RESPONSE"
                        echo "\$RESPONSE" | grep -q '"status":"degraded"' && echo "OK: sistema en modo degradado, sigue respondiendo" || (echo "FALLO: el sistema no se degrado correctamente" && exit 1)

                        echo "=== Recuperando Redis ==="
                        docker compose -f ${DOCKER_COMPOSE_FILE} start redis
                        sleep 10

                        echo "Verificando recuperacion completa..."
                        docker run --rm --network ${env.APP_NETWORK} curlimages/curl -s -f http://user-service:3001/health

                        echo ""
                        echo "=== Simulando fallo de PostgreSQL ==="
                        docker compose -f ${DOCKER_COMPOSE_FILE} stop postgres
                        sleep 5

                        echo "Verificando degradacion graceful..."
                        RESPONSE2=\$(docker run --rm --network ${env.APP_NETWORK} curlimages/curl -s http://user-service:3001/health)
                        echo "\$RESPONSE2"
                        echo "\$RESPONSE2" | grep -q '"status":"degraded"' && echo "OK: sistema en modo degradado, sigue respondiendo" || (echo "FALLO: el sistema no se degrado correctamente" && exit 1)

                        echo "=== Recuperando PostgreSQL ==="
                        docker compose -f ${DOCKER_COMPOSE_FILE} start postgres
                        sleep 10

                        echo "Verificando recuperacion completa del sistema..."
                        timeout 30 sh -c 'until docker run --rm --network ${env.APP_NETWORK} curlimages/curl -s -f http://user-service:3001/health; do sleep 2; done'
                        echo "Sistema completamente recuperado."
                    """
                }
            }
            post {
                always {
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true"
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline completado exitosamente.'
            script {
                def summary = """
                    Pipeline exitoso: ${env.JOB_NAME} #${env.BUILD_NUMBER}
                    Commit: ${env.GIT_COMMIT ? env.GIT_COMMIT.take(7) : 'local'}
                    URL: ${env.BUILD_URL}
                    Todos los stages pasaron: verificacion, contrato, build/test, integracion, carga y resiliencia.
                """
                writeFile file: 'pipeline-summary.txt', text: summary
                archiveArtifacts artifacts: 'pipeline-summary.txt', allowEmptyArchive: true
            }
        }
        failure {
            echo 'Pipeline fallido. Ejecutando limpieza y rollback de entorno...'
            script {
                // Rollback: aseguramos que no queden contenedores ni volumenes huerfanos
                // de ningun docker-compose de este proyecto, para que el proximo build
                // arranque desde un estado limpio (equivalente al "kubectl rollout undo"
                // del entorno real, adaptado a Docker Compose local).
                sh "docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true"
                sh "docker image prune -f || true"

                def failureSummary = """
                    Pipeline fallido: ${env.JOB_NAME} #${env.BUILD_NUMBER}
                    Commit: ${env.GIT_COMMIT ? env.GIT_COMMIT.take(7) : 'local'}
                    Revisa los logs en: ${env.BUILD_URL}console
                    Se ejecuto rollback automatico: entorno de contenedores limpiado.
                """
                writeFile file: 'pipeline-failure-summary.txt', text: failureSummary
                archiveArtifacts artifacts: 'pipeline-failure-summary.txt', allowEmptyArchive: true
            }
        }
        always {
            echo 'Limpiando workspace...'
            cleanWs()
        }
    }
}

// Función auxiliar para build y test de servicios
def buildAndTestService(String serviceName) {
    dir("services/${serviceName}") {
        sh 'npm ci'
        sh 'npm run test:unit'
    }
    junit allowEmptyResults: true, testResults: "services/${serviceName}/coverage/junit.xml"
}