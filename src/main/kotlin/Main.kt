import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class Health(val status: String)

@Serializable
data class PlacesResponse(val places: List<String>)

fun main() {
    embeddedServer(
        Netty,
        port = 8000,
        host = "0.0.0.0"
    ) {
        install(ContentNegotiation) {
            json()
        }

        routing {
            get("/health") {
                call.respond(Health(status = "ok"))
            }

            get("/api/v1/places") {
                call.respond(PlacesResponse(places = emptyList()))
            }
        }
    }.start(wait = true)
}
