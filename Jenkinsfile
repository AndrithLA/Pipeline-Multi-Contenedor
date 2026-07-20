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
                sh "docker compose -f ${DOCKER_COMPOSE_FILE} up -d --build"
                sh 'sleep 15'

                script {
                    sh '''
                        echo "Esperando API Gateway..."
                        timeout 60 sh -c 'while ! curl -s -f http://localhost:3000/health; do sleep 2; done'

                        echo "Esperando User Service..."
                        timeout 60 sh -c 'while ! curl -s -f http://localhost:3001/health; do sleep 2; done'

                        echo "Esperando Product Service..."
                        timeout 60 sh -c 'while ! curl -s -f http://localhost:3002/health; do sleep 2; done'
                    '''
                }

                echo 'Ejecutando pruebas funcionales de integración...'
                sh '''
                    echo "=== Prueba: crear usuario via gateway ==="
                    curl -f -X POST http://localhost:3000/users \
                        -H "Content-Type: application/json" \
                        -d '{"name":"CI Test User","email":"ci-test-'$(date +%s)'@example.com"}'

                    echo ""
                    echo "=== Prueba: listar productos ==="
                    curl -f http://localhost:3002/products
                '''
            }
            post {
                always {
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} logs --tail=50 > integration-logs.txt || true"
                    archiveArtifacts artifacts: 'integration-logs.txt', allowEmptyArchive: true
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true"
                }
            }
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